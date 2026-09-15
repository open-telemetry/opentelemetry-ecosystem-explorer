# Copyright The OpenTelemetry Authors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

"""Tests for PackageParser."""

import textwrap
from pathlib import Path

import pytest
from python_instrumentation_watcher.package_parser import PackageParser


@pytest.fixture
def repo(tmp_path):
    (tmp_path / "instrumentation").mkdir()
    return tmp_path


@pytest.fixture
def pkg_dir(repo):
    pkg = repo / "instrumentation" / "opentelemetry-instrumentation-flask"
    pkg.mkdir()
    return pkg


def write_pyproject(pkg_dir: Path, content: str) -> None:
    (pkg_dir / "pyproject.toml").write_text(textwrap.dedent(content))


def write_package_py(
    pkg_dir: Path,
    content: str,
    rel_path: str = "src/opentelemetry/instrumentation/flask/package.py",
) -> None:
    path = pkg_dir / rel_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(textwrap.dedent(content))


BASIC_PYPROJECT = """\
    [project]
    name = "opentelemetry-instrumentation-flask"
    version = "0.48b0"
    description = "OpenTelemetry Flask instrumentation"
    requires-python = ">=3.9"

    [project.urls]
    Homepage = "https://github.com/open-telemetry/opentelemetry-python-contrib/tree/main/instrumentation/opentelemetry-instrumentation-flask"

    [project.optional-dependencies]
    instruments = ["flask >= 1.0"]

    [project.entry-points.opentelemetry_instrumentor]
    flask = "opentelemetry.instrumentation.flask:FlaskInstrumentor"
    """


def test_parse_basic_fields(repo, pkg_dir):
    write_pyproject(pkg_dir, BASIC_PYPROJECT)

    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    result = parser.parse()

    assert result is not None
    assert result["name"] == "opentelemetry-instrumentation-flask"
    assert result["version"] == "0.48b0"
    assert result["description"] == "OpenTelemetry Flask instrumentation"
    assert result["requires_python"] == ">=3.9"
    assert result["repository"] == "open-telemetry/opentelemetry-python-contrib"
    assert result["source_path"] == "instrumentation/opentelemetry-instrumentation-flask"
    assert result["homepage"] == (
        "https://github.com/open-telemetry/opentelemetry-python-contrib/tree/main/"
        "instrumentation/opentelemetry-instrumentation-flask"
    )
    assert result["instruments"] == [{"library": "flask", "version_range": ">= 1.0", "source_key": "instruments"}]
    assert result["entry_points"] == [
        {"name": "flask", "value": "opentelemetry.instrumentation.flask:FlaskInstrumentor"}
    ]
    assert result["semantic_convention_status"] is None
    assert result["supports_metrics"] is None


def test_parse_returns_none_on_missing_pyproject_toml(repo, pkg_dir):
    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    assert parser.parse() is None


def test_parse_returns_none_on_malformed_toml(repo, pkg_dir):
    (pkg_dir / "pyproject.toml").write_text("this is not [valid toml")

    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    assert parser.parse() is None


def test_parse_returns_none_when_project_table_missing(repo, pkg_dir):
    write_pyproject(pkg_dir, '[build-system]\nrequires = ["hatchling"]\n')

    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    assert parser.parse() is None


def test_parse_returns_none_when_name_missing(repo, pkg_dir):
    write_pyproject(pkg_dir, '[project]\ndescription = "no name"\n')

    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    assert parser.parse() is None


def test_parse_defaults_missing_optional_fields(repo, pkg_dir):
    write_pyproject(pkg_dir, '[project]\nname = "opentelemetry-instrumentation-flask"\nversion = "1.0.0"\n')

    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    result = parser.parse()

    assert result is not None
    assert result["description"] == ""
    assert result["requires_python"] == ""
    assert result["homepage"] is None
    assert result["instruments"] == []
    assert result["entry_points"] == []


def test_parse_resolves_dynamic_version_from_hatch_path(repo, pkg_dir):
    write_pyproject(
        pkg_dir,
        """\
        [project]
        name = "opentelemetry-instrumentation-flask"
        dynamic = ["version"]

        [tool.hatch.version]
        path = "src/opentelemetry/instrumentation/flask/version.py"
        """,
    )
    version_file = pkg_dir / "src/opentelemetry/instrumentation/flask/version.py"
    version_file.parent.mkdir(parents=True)
    version_file.write_text('__version__ = "0.58b0.dev"\n')

    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    result = parser.parse()

    assert result is not None
    assert result["version"] == "0.58b0.dev"


def test_parse_dynamic_version_missing_hatch_path_yields_empty_version(repo, pkg_dir):
    write_pyproject(pkg_dir, '[project]\nname = "opentelemetry-instrumentation-flask"\ndynamic = ["version"]\n')

    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    result = parser.parse()

    assert result is not None
    assert result["version"] == ""


def test_parse_dynamic_version_missing_file_yields_empty_version(repo, pkg_dir):
    write_pyproject(
        pkg_dir,
        """\
        [project]
        name = "opentelemetry-instrumentation-flask"
        dynamic = ["version"]

        [tool.hatch.version]
        path = "src/opentelemetry/instrumentation/flask/version.py"
        """,
    )

    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    result = parser.parse()

    assert result is not None
    assert result["version"] == ""


def test_parse_static_version_takes_priority_over_dynamic(repo, pkg_dir):
    write_pyproject(
        pkg_dir,
        """\
        [project]
        name = "opentelemetry-instrumentation-flask"
        version = "2.0.0"
        """,
    )

    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    result = parser.parse()

    assert result is not None
    assert result["version"] == "2.0.0"


def test_parse_instruments_any_preserves_source_key(repo, pkg_dir):
    write_pyproject(
        pkg_dir,
        """\
        [project]
        name = "opentelemetry-instrumentation-botocore"
        version = "1.0.0"

        [project.optional-dependencies]
        instruments-any = ["boto3 >= 1.0", "botocore >= 1.0"]
        """,
    )

    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    result = parser.parse()

    assert result is not None
    assert result["instruments"] == [
        {"library": "boto3", "version_range": ">= 1.0", "source_key": "instruments-any"},
        {"library": "botocore", "version_range": ">= 1.0", "source_key": "instruments-any"},
    ]


def test_parse_instruments_sorted_deterministically(repo, pkg_dir):
    write_pyproject(
        pkg_dir,
        """\
        [project]
        name = "opentelemetry-instrumentation-multi"
        version = "1.0.0"

        [project.optional-dependencies]
        instruments = ["zeta >= 1.0", "alpha >= 1.0"]
        """,
    )

    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    result = parser.parse()

    libraries = [e["library"] for e in result["instruments"]]
    assert libraries == sorted(libraries)


def test_parse_instruments_preserves_raw_version_range_text(repo, pkg_dir):
    write_pyproject(
        pkg_dir,
        """\
        [project]
        name = "opentelemetry-instrumentation-flask"
        version = "1.0.0"

        [project.optional-dependencies]
        instruments = ["flask>=1.0,<3.0"]
        """,
    )

    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    result = parser.parse()

    # Not renormalized: the exact spacing/format from the source is preserved.
    assert result["instruments"] == [{"library": "flask", "version_range": ">=1.0,<3.0", "source_key": "instruments"}]


def test_parse_instruments_handles_no_version_constraint(repo, pkg_dir):
    write_pyproject(
        pkg_dir,
        """\
        [project]
        name = "opentelemetry-instrumentation-flask"
        version = "1.0.0"

        [project.optional-dependencies]
        instruments = ["flask"]
        """,
    )

    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    result = parser.parse()

    assert result["instruments"] == [{"library": "flask", "version_range": "", "source_key": "instruments"}]


def test_parse_instruments_skips_unparseable_entry(repo, pkg_dir):
    write_pyproject(
        pkg_dir,
        """\
        [project]
        name = "opentelemetry-instrumentation-flask"
        version = "1.0.0"

        [project.optional-dependencies]
        instruments = ["", "flask >= 1.0"]
        """,
    )

    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    result = parser.parse()

    assert len(result["instruments"]) == 1
    assert result["instruments"][0]["library"] == "flask"


def test_parse_handles_non_list_optional_dependencies(repo, pkg_dir):
    write_pyproject(
        pkg_dir,
        """\
        [project]
        name = "opentelemetry-instrumentation-flask"
        version = "1.0.0"
        optional-dependencies = "not-a-table"
        """,
    )

    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    result = parser.parse()

    assert result is not None
    assert result["instruments"] == []


def test_parse_entry_points_sorted_by_name(repo, pkg_dir):
    write_pyproject(
        pkg_dir,
        """\
        [project]
        name = "opentelemetry-instrumentation-multi"
        version = "1.0.0"

        [project.entry-points.opentelemetry_instrumentor]
        zeta = "pkg.zeta:ZetaInstrumentor"
        alpha = "pkg.alpha:AlphaInstrumentor"
        """,
    )

    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    result = parser.parse()

    names = [e["name"] for e in result["entry_points"]]
    assert names == ["alpha", "zeta"]


def test_parse_homepage_case_insensitive_key(repo, pkg_dir):
    write_pyproject(
        pkg_dir,
        """\
        [project]
        name = "opentelemetry-instrumentation-flask"
        version = "1.0.0"

        [project.urls]
        homepage = "https://example.com/flask"
        """,
    )

    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    result = parser.parse()

    assert result["homepage"] == "https://example.com/flask"


def test_parse_package_py_fields(repo, pkg_dir):
    write_pyproject(pkg_dir, BASIC_PYPROJECT)
    write_package_py(
        pkg_dir,
        """\
        _instruments = ("flask >= 1.0",)
        _supports_metrics = True
        _semconv_status = "stable"
        """,
    )

    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    result = parser.parse()

    assert result["semantic_convention_status"] == "stable"
    assert result["supports_metrics"] is True


def test_parse_package_py_missing_yields_none_fields(repo, pkg_dir):
    write_pyproject(pkg_dir, BASIC_PYPROJECT)

    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    result = parser.parse()

    assert result["semantic_convention_status"] is None
    assert result["supports_metrics"] is None


def test_parse_package_py_skips_test_directories(repo, pkg_dir):
    write_pyproject(pkg_dir, BASIC_PYPROJECT)
    write_package_py(
        pkg_dir,
        '_semconv_status = "should-not-be-used"\n',
        rel_path="tests/package.py",
    )

    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    result = parser.parse()

    assert result["semantic_convention_status"] is None


def test_parse_package_py_ignores_non_literal_assignment(repo, pkg_dir):
    write_pyproject(pkg_dir, BASIC_PYPROJECT)
    write_package_py(
        pkg_dir,
        """\
        _semconv_status = some_function_call()
        _supports_metrics = True
        """,
    )

    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    result = parser.parse()

    # Unevaluatable expression is skipped rather than raising or executing code.
    assert result["semantic_convention_status"] is None
    assert result["supports_metrics"] is True


def test_parse_package_py_malformed_syntax_does_not_raise(repo, pkg_dir):
    write_pyproject(pkg_dir, BASIC_PYPROJECT)
    write_package_py(pkg_dir, "def broken(:\n")

    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    result = parser.parse()

    assert result is not None
    assert result["semantic_convention_status"] is None


def test_has_metadata_disagreement_false_when_package_py_absent(repo, pkg_dir):
    write_pyproject(pkg_dir, BASIC_PYPROJECT)

    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    parser.parse()

    assert parser.has_metadata_disagreement() is False


def test_has_metadata_disagreement_false_when_sources_agree(repo, pkg_dir):
    write_pyproject(pkg_dir, BASIC_PYPROJECT)
    write_package_py(pkg_dir, '_instruments = ("flask >= 1.0",)\n')

    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    parser.parse()

    assert parser.has_metadata_disagreement() is False


def test_has_metadata_disagreement_ignores_whitespace_only_differences(repo, pkg_dir):
    write_pyproject(pkg_dir, BASIC_PYPROJECT)
    write_package_py(pkg_dir, '_instruments = ("flask>=1.0",)\n')

    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    parser.parse()

    assert parser.has_metadata_disagreement() is False


def test_has_metadata_disagreement_true_when_version_ranges_differ(repo, pkg_dir):
    write_pyproject(pkg_dir, BASIC_PYPROJECT)
    write_package_py(pkg_dir, '_instruments = ("flask >= 2.0",)\n')

    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    parser.parse()

    assert parser.has_metadata_disagreement() is True


def test_has_metadata_disagreement_false_for_httpx_botocore_style_empty_instruments(repo, pkg_dir):
    """Exact scenario from the PR #1099 review: real upstream packages like httpx and
    botocore define `_instruments = ()` and put their actual requirements in
    `_instruments_any`. Before the fix, comparing only `_instruments` against the
    combined pyproject set compared an empty set against a populated one and always
    falsely reported a disagreement for these packages.
    """
    write_pyproject(
        pkg_dir,
        """\
        [project]
        name = "opentelemetry-instrumentation-httpx"
        version = "1.0.0"

        [project.optional-dependencies]
        instruments-any = ["httpx >= 0.18.0"]
        """,
    )
    write_package_py(
        pkg_dir,
        """\
        _instruments = ()
        _instruments_any = ("httpx >= 0.18.0",)
        """,
    )

    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    parser.parse()

    assert parser.has_metadata_disagreement() is False


def test_has_metadata_disagreement_true_when_library_sets_differ(repo, pkg_dir):
    write_pyproject(pkg_dir, BASIC_PYPROJECT)
    write_package_py(pkg_dir, '_instruments = ("flask >= 1.0", "werkzeug >= 1.0")\n')

    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    parser.parse()

    assert parser.has_metadata_disagreement() is True


def test_has_metadata_disagreement_false_when_package_py_only_mirrors_instruments_key(repo, pkg_dir):
    """Regression test: package.py legitimately doesn't have to mirror `instruments-any`.

    pyproject.toml declares both `instruments` and `instruments-any`; package.py only
    defines `_instruments` (matching `instruments`). Before the fix, `_instruments` was
    compared against the *combined* pyproject set, so this agreeing-but-partial package.py
    was always falsely flagged as disagreeing.
    """
    write_pyproject(
        pkg_dir,
        """\
        [project]
        name = "opentelemetry-instrumentation-botocore"
        version = "1.0.0"

        [project.optional-dependencies]
        instruments = ["botocore >= 1.0"]
        instruments-any = ["boto3 >= 1.0", "aiobotocore >= 1.0"]
        """,
    )
    write_package_py(pkg_dir, '_instruments = ("botocore >= 1.0",)\n')

    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    parser.parse()

    assert parser.has_metadata_disagreement() is False


def test_has_metadata_disagreement_true_when_instruments_any_field_disagrees(repo, pkg_dir):
    write_pyproject(
        pkg_dir,
        """\
        [project]
        name = "opentelemetry-instrumentation-botocore"
        version = "1.0.0"

        [project.optional-dependencies]
        instruments = ["botocore >= 1.0"]
        instruments-any = ["boto3 >= 1.0"]
        """,
    )
    write_package_py(
        pkg_dir,
        """\
        _instruments = ("botocore >= 1.0",)
        _instruments_any = ("boto3 >= 2.0",)
        """,
    )

    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    parser.parse()

    assert parser.has_metadata_disagreement() is True


def test_has_metadata_disagreement_false_when_instruments_and_instruments_any_both_agree(repo, pkg_dir):
    write_pyproject(
        pkg_dir,
        """\
        [project]
        name = "opentelemetry-instrumentation-botocore"
        version = "1.0.0"

        [project.optional-dependencies]
        instruments = ["botocore >= 1.0"]
        instruments-any = ["boto3 >= 1.0"]
        """,
    )
    write_package_py(
        pkg_dir,
        """\
        _instruments = ("botocore >= 1.0",)
        _instruments_any = ("boto3 >= 1.0",)
        """,
    )

    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    parser.parse()

    assert parser.has_metadata_disagreement() is False


def test_has_metadata_disagreement_true_when_package_py_declares_instruments_pyproject_lacks(repo, pkg_dir):
    """package.py explicitly declaring instruments that pyproject.toml doesn't have at all
    (under that specific key) is a real, reportable disagreement — not silent."""
    write_pyproject(
        pkg_dir,
        """\
        [project]
        name = "opentelemetry-instrumentation-botocore"
        version = "1.0.0"

        [project.optional-dependencies]
        instruments = ["botocore >= 1.0"]
        """,
    )
    write_package_py(pkg_dir, '_instruments_any = ("boto3 >= 1.0",)\n')

    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    parser.parse()

    assert parser.has_metadata_disagreement() is True


def test_parse_package_py_handles_annotated_instruments_assignment(repo, pkg_dir):
    write_pyproject(pkg_dir, BASIC_PYPROJECT)
    write_package_py(pkg_dir, '_instruments: tuple[str, ...] = ("flask >= 1.0",)\n')

    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    parser.parse()

    # Would stay a false negative if AnnAssign weren't handled: the field would read as
    # "not defined" and no disagreement would ever be reported for this package.py.
    assert parser.has_metadata_disagreement() is False


def test_has_metadata_disagreement_true_with_annotated_assignment_mismatch(repo, pkg_dir):
    write_pyproject(pkg_dir, BASIC_PYPROJECT)
    write_package_py(pkg_dir, '_instruments: tuple[str, ...] = ("flask >= 9.0",)\n')

    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    parser.parse()

    assert parser.has_metadata_disagreement() is True


def test_parse_package_py_handles_empty_tuple_call_annotated_assignment(repo, pkg_dir):
    """`tuple()` is a Call node, not a literal — ast.literal_eval alone can't read it."""
    write_pyproject(pkg_dir, '[project]\nname = "opentelemetry-instrumentation-flask"\nversion = "1.0.0"\n')
    write_package_py(pkg_dir, "_instruments: tuple[str, ...] = tuple()\n")

    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    parser.parse()

    # package.py explicitly declares zero instruments, and pyproject.toml agrees (none
    # declared either) — not a disagreement.
    assert parser.has_metadata_disagreement() is False


def test_has_metadata_disagreement_true_when_package_py_empty_tuple_call_but_pyproject_has_entries(repo, pkg_dir):
    write_pyproject(pkg_dir, BASIC_PYPROJECT)
    write_package_py(pkg_dir, "_instruments: tuple[str, ...] = tuple()\n")

    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    parser.parse()

    assert parser.has_metadata_disagreement() is True


def test_parse_package_py_handles_annotated_scalar_assignment(repo, pkg_dir):
    write_pyproject(pkg_dir, BASIC_PYPROJECT)
    write_package_py(
        pkg_dir,
        """\
        _semconv_status: str = "stable"
        _supports_metrics: bool = True
        """,
    )

    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    result = parser.parse()

    assert result["semantic_convention_status"] == "stable"
    assert result["supports_metrics"] is True


def test_parse_package_py_annotation_only_statement_without_value_is_ignored(repo, pkg_dir):
    """`_instruments: tuple[str, ...]` with no assigned value must not be evaluated as None."""
    write_pyproject(pkg_dir, BASIC_PYPROJECT)
    write_package_py(pkg_dir, "_instruments: tuple[str, ...]\n")

    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    parser.parse()

    # No value was ever assigned, so this is indistinguishable from "not defined".
    assert parser.has_metadata_disagreement() is False


def test_parse_package_py_unrecognized_call_is_not_evaluated(repo, pkg_dir):
    """Only the explicit empty-container allowlist is accepted; other calls are skipped, not executed."""
    write_pyproject(pkg_dir, BASIC_PYPROJECT)
    write_package_py(pkg_dir, "_instruments = some_function_call()\n")

    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    parser.parse()

    # some_function_call() is neither a literal nor a recognized empty-container call, so
    # the field is left unset (as if not defined) rather than raising or being invoked.
    assert parser.has_metadata_disagreement() is False


def test_parse_uses_first_package_py_when_multiple_found(repo, pkg_dir):
    write_pyproject(pkg_dir, BASIC_PYPROJECT)
    write_package_py(pkg_dir, '_semconv_status = "stable"\n', rel_path="src/a/package.py")
    write_package_py(pkg_dir, '_semconv_status = "experimental"\n', rel_path="src/b/package.py")

    parser = PackageParser(package_path=pkg_dir, repo_path=repo)
    result = parser.parse()

    # Deterministic: sorted candidate paths, first one wins.
    assert result["semantic_convention_status"] == "stable"
