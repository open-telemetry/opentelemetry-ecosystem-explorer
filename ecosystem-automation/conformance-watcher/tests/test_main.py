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
"""End-to-end and CLI tests for conformance-watcher."""

import argparse
import hashlib
import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import yaml
from conformance_watcher.main import parse_args, run_sync


def create_sample_report(target_name: str = "http/go/net-http") -> dict:
    return {
        "schema_version": 1,
        "domains": {
            "http-conformance": {
                "registry_dir": "model",
                "registry_ref": "v1.44.0",
                "registry_repo": "open-telemetry/semantic-conventions",
            }
        },
        "registry": {
            "http-conformance": {
                "spans": {},
            }
        },
        "targets": [
            {
                "id": target_name,
                "runner": "http-conformance",
                "domain": "http",
                "language": "go",
                "path": f"scenarios/{target_name}",
            }
        ],
    }


def test_parse_args_defaults() -> None:
    args = parse_args([])
    assert args.revision is None
    assert args.repo == "open-telemetry/semantic-conventions-conformance"
    assert args.report_path == "docs/data/conformance.json"
    assert args.output_dir == "ecosystem-registry/conformance"
    assert not args.validate_only
    assert not hasattr(args, "force")


def test_run_sync_initial_import(tmp_path: Path) -> None:
    sample_data = create_sample_report()
    formatted_json = json.dumps(sample_data, indent=2, sort_keys=True) + "\n"
    formatted_bytes = formatted_json.encode("utf-8")
    digest = f"sha256:{hashlib.sha256(formatted_bytes).hexdigest()}"

    with patch("conformance_watcher.main.ConformanceClient") as mock_client_cls:
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client
        mock_client.resolve_revision.return_value = "6f85d0aa70eb55116d161c5c0737a6ba55faf101"
        mock_client.fetch_report.return_value = (sample_data, formatted_bytes, digest)

        args = argparse.Namespace(
            revision="6f85d0aa70eb55116d161c5c0737a6ba55faf101",
            repo="open-telemetry/semantic-conventions-conformance",
            report_path="docs/data/conformance.json",
            output_dir=str(tmp_path),
            validate_only=False,
        )

        code = run_sync(args)
        assert code == 0

        report_file = tmp_path / "report.json"
        source_file = tmp_path / "source.yaml"

        assert report_file.exists()
        assert source_file.exists()

        assert json.loads(report_file.read_text(encoding="utf-8")) == sample_data

        source_data = yaml.safe_load(source_file.read_text(encoding="utf-8"))
        assert source_data["repository"] == "open-telemetry/semantic-conventions-conformance"
        assert source_data["revision"] == "6f85d0aa70eb55116d161c5c0737a6ba55faf101"
        assert source_data["report_path"] == "docs/data/conformance.json"
        assert source_data["schema_version"] == 1
        assert source_data["digest"] == digest


def test_run_sync_idempotent_when_content_matches(tmp_path: Path) -> None:
    sample_data = create_sample_report()
    formatted_json = json.dumps(sample_data, indent=2, sort_keys=True) + "\n"
    formatted_bytes = formatted_json.encode("utf-8")
    digest = f"sha256:{hashlib.sha256(formatted_bytes).hexdigest()}"

    # Pre-populate report.json and source.yaml
    report_file = tmp_path / "report.json"
    source_file = tmp_path / "source.yaml"
    report_file.write_bytes(formatted_bytes)
    source_file.write_text("dummy: data\n", encoding="utf-8")
    mtime_report = report_file.stat().st_mtime_ns
    mtime_source = source_file.stat().st_mtime_ns

    with patch("conformance_watcher.main.ConformanceClient") as mock_client_cls:
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client
        mock_client.resolve_revision.return_value = "newcommit11111111111111111111111111111111"
        mock_client.fetch_report.return_value = (sample_data, formatted_bytes, digest)

        args = argparse.Namespace(
            revision=None,
            repo="open-telemetry/semantic-conventions-conformance",
            report_path="docs/data/conformance.json",
            output_dir=str(tmp_path),
            validate_only=False,
        )

        # When content matches committed report.json, write nothing and exit 0
        code = run_sync(args)
        assert code == 0

        # Files were untouched
        assert report_file.stat().st_mtime_ns == mtime_report
        assert source_file.stat().st_mtime_ns == mtime_source
        assert source_file.read_text(encoding="utf-8") == "dummy: data\n"


def test_run_sync_content_changed_overwrites_in_place(tmp_path: Path) -> None:
    sample_data1 = create_sample_report("target1")
    formatted_bytes1 = (json.dumps(sample_data1, indent=2, sort_keys=True) + "\n").encode("utf-8")
    digest1 = f"sha256:{hashlib.sha256(formatted_bytes1).hexdigest()}"

    sample_data2 = create_sample_report("target2")
    formatted_bytes2 = (json.dumps(sample_data2, indent=2, sort_keys=True) + "\n").encode("utf-8")
    digest2 = f"sha256:{hashlib.sha256(formatted_bytes2).hexdigest()}"

    with patch("conformance_watcher.main.ConformanceClient") as mock_client_cls:
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client

        # Initial import
        mock_client.resolve_revision.return_value = "1111111111111111111111111111111111111111"
        mock_client.fetch_report.return_value = (sample_data1, formatted_bytes1, digest1)

        args = argparse.Namespace(
            revision="main",
            repo="open-telemetry/semantic-conventions-conformance",
            report_path="docs/data/conformance.json",
            output_dir=str(tmp_path),
            validate_only=False,
        )
        assert run_sync(args) == 0

        source1 = yaml.safe_load((tmp_path / "source.yaml").read_text(encoding="utf-8"))
        assert source1["revision"] == "1111111111111111111111111111111111111111"
        assert source1["digest"] == digest1

        # Second import with new report content
        mock_client.resolve_revision.return_value = "2222222222222222222222222222222222222222"
        mock_client.fetch_report.return_value = (sample_data2, formatted_bytes2, digest2)
        assert run_sync(args) == 0

        source2 = yaml.safe_load((tmp_path / "source.yaml").read_text(encoding="utf-8"))
        assert source2["revision"] == "2222222222222222222222222222222222222222"
        assert source2["digest"] == digest2
        assert json.loads((tmp_path / "report.json").read_text(encoding="utf-8")) == sample_data2


def test_run_sync_validation_failure_preserves_previous(tmp_path: Path) -> None:
    sample_data = create_sample_report("target1")
    formatted_bytes = (json.dumps(sample_data, indent=2, sort_keys=True) + "\n").encode("utf-8")
    digest = f"sha256:{hashlib.sha256(formatted_bytes).hexdigest()}"

    with patch("conformance_watcher.main.ConformanceClient") as mock_client_cls:
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client

        # Initial valid import
        mock_client.resolve_revision.return_value = "1111111111111111111111111111111111111111"
        mock_client.fetch_report.return_value = (sample_data, formatted_bytes, digest)

        args = argparse.Namespace(
            revision="main",
            repo="open-telemetry/semantic-conventions-conformance",
            report_path="docs/data/conformance.json",
            output_dir=str(tmp_path),
            validate_only=False,
        )
        assert run_sync(args) == 0

        # Attempt to import invalid report
        invalid_data = create_sample_report("target2")
        invalid_data["schema_version"] = 99
        invalid_bytes = (json.dumps(invalid_data, indent=2, sort_keys=True) + "\n").encode("utf-8")
        invalid_digest = f"sha256:{hashlib.sha256(invalid_bytes).hexdigest()}"

        mock_client.resolve_revision.return_value = "2222222222222222222222222222222222222222"
        mock_client.fetch_report.return_value = (invalid_data, invalid_bytes, invalid_digest)

        assert run_sync(args) == 1

        # Previous state preserved
        source = yaml.safe_load((tmp_path / "source.yaml").read_text(encoding="utf-8"))
        assert source["revision"] == "1111111111111111111111111111111111111111"
        assert json.loads((tmp_path / "report.json").read_text(encoding="utf-8")) == sample_data


def test_validate_only_mode(tmp_path: Path) -> None:
    sample_data = create_sample_report()
    formatted_bytes = (json.dumps(sample_data, indent=2, sort_keys=True) + "\n").encode("utf-8")
    digest = f"sha256:{hashlib.sha256(formatted_bytes).hexdigest()}"

    with patch("conformance_watcher.main.ConformanceClient") as mock_client_cls:
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client
        mock_client.resolve_revision.return_value = "1111111111111111111111111111111111111111"
        mock_client.fetch_report.return_value = (sample_data, formatted_bytes, digest)

        sync_args = argparse.Namespace(
            revision="main",
            repo="open-telemetry/semantic-conventions-conformance",
            report_path="docs/data/conformance.json",
            output_dir=str(tmp_path),
            validate_only=False,
        )
        assert run_sync(sync_args) == 0

    val_args = argparse.Namespace(
        revision=None,
        repo="open-telemetry/semantic-conventions-conformance",
        report_path="docs/data/conformance.json",
        output_dir=str(tmp_path),
        validate_only=True,
    )
    assert run_sync(val_args) == 0

    # Test failure on corrupted digest in source.yaml
    source_file = tmp_path / "source.yaml"
    source_data = yaml.safe_load(source_file.read_text(encoding="utf-8"))
    source_data["digest"] = "sha256:corrupted"
    source_file.write_text(yaml.safe_dump(source_data), encoding="utf-8")
    assert run_sync(val_args) == 1


def test_validate_existing_error_cases(tmp_path: Path) -> None:
    val_args = argparse.Namespace(
        revision=None,
        repo="open-telemetry/semantic-conventions-conformance",
        report_path="docs/data/conformance.json",
        output_dir=str(tmp_path),
        validate_only=True,
    )
    # Missing files
    assert run_sync(val_args) == 1

    report_file = tmp_path / "report.json"
    source_file = tmp_path / "source.yaml"

    report_file.write_text("{}", encoding="utf-8")
    assert run_sync(val_args) == 1  # Missing source.yaml

    source_file.write_text("not a dict\n", encoding="utf-8")
    assert run_sync(val_args) == 1

    source_file.write_text("repository: repo\n", encoding="utf-8")
    assert run_sync(val_args) == 1  # Missing required fields

    valid_sample = create_sample_report()
    formatted = json.dumps(valid_sample, indent=2, sort_keys=True) + "\n"
    report_file.write_bytes(formatted.encode("utf-8"))

    source_file.write_text(
        "repository: repo\nrevision: not-a-sha\nreport_path: safe/path\nschema_version: 1\ndigest: sha256:abc\n",
        encoding="utf-8",
    )
    assert run_sync(val_args) == 1  # Invalid SHA

    source_file.write_text(
        "repository: repo\n"
        "revision: 1111111111111111111111111111111111111111\n"
        "report_path: ../unsafe\n"
        "schema_version: 1\n"
        "digest: sha256:abc\n",
        encoding="utf-8",
    )
    assert run_sync(val_args) == 1  # Unsafe path


def test_main_cli_entrypoint() -> None:
    with patch("conformance_watcher.main.run_sync", return_value=0) as mock_sync:
        with patch("sys.argv", ["conformance-watcher", "--validate-only"]):
            import pytest
            from conformance_watcher.main import main

            with pytest.raises(SystemExit) as exc:
                main()
            assert exc.value.code == 0
            mock_sync.assert_called_once()
