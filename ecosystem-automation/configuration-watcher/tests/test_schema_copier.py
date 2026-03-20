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
"""Tests for schema copier."""

import pytest
from configuration_watcher.schema_copier import SchemaCopier


@pytest.fixture
def repo_with_schemas(tmp_path):
    """Create a fake repo directory with schema files."""
    repo_path = tmp_path / "repo"
    schema_dir = repo_path / "schema"
    schema_dir.mkdir(parents=True)

    (schema_dir / "common.yaml").write_text("common: true")
    (schema_dir / "tracer_provider.yaml").write_text("tracer: true")
    (schema_dir / "meter_provider.yaml").write_text("meter: true")
    # Non-yaml file should be ignored
    (schema_dir / "README.md").write_text("# Schema docs")
    (schema_dir / "compiled.json").write_text("{}")

    return repo_path


@pytest.fixture
def copier():
    return SchemaCopier()


class TestSchemaCopier:
    def test_copy_schemas(self, copier, repo_with_schemas, tmp_path):
        target = tmp_path / "output"
        result = copier.copy_schemas(repo_with_schemas, target)

        assert len(result) == 3
        assert (target / "common.yaml").exists()
        assert (target / "tracer_provider.yaml").exists()
        assert (target / "meter_provider.yaml").exists()

    def test_copy_schemas_returns_sorted_file_list(self, copier, repo_with_schemas, tmp_path):
        target = tmp_path / "output"
        result = copier.copy_schemas(repo_with_schemas, target)

        assert result == ["common.yaml", "meter_provider.yaml", "tracer_provider.yaml"]

    def test_copy_schemas_empty_directory(self, copier, tmp_path):
        repo_path = tmp_path / "repo"
        schema_dir = repo_path / "schema"
        schema_dir.mkdir(parents=True)

        target = tmp_path / "output"
        result = copier.copy_schemas(repo_path, target)

        assert result == []

    def test_copy_schemas_ignores_non_yaml(self, copier, repo_with_schemas, tmp_path):
        target = tmp_path / "output"
        copier.copy_schemas(repo_with_schemas, target)

        assert not (target / "README.md").exists()
        assert not (target / "compiled.json").exists()

    def test_copy_schemas_creates_target_dir(self, copier, repo_with_schemas, tmp_path):
        target = tmp_path / "nested" / "deep" / "output"
        assert not target.exists()

        copier.copy_schemas(repo_with_schemas, target)

        assert target.exists()

    def test_copy_schemas_missing_schema_dir(self, copier, tmp_path):
        repo_path = tmp_path / "repo"
        repo_path.mkdir()
        target = tmp_path / "output"

        with pytest.raises(FileNotFoundError, match="Schema directory not found"):
            copier.copy_schemas(repo_path, target)

    def test_copy_schemas_ignores_subdirectories(self, copier, tmp_path):
        repo_path = tmp_path / "repo"
        schema_dir = repo_path / "schema"
        schema_dir.mkdir(parents=True)

        (schema_dir / "main.yaml").write_text("main: true")
        subdir = schema_dir / "subdir"
        subdir.mkdir()
        (subdir / "nested.yaml").write_text("nested: true")

        target = tmp_path / "output"
        result = copier.copy_schemas(repo_path, target)

        assert result == ["main.yaml"]
        assert not (target / "subdir").exists()
