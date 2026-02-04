"""Tests for metadata diagnostics tracking."""

import pytest
from documentation_sync.doc_content_generator import DocContentGenerator
from documentation_sync.metadata_diagnostics import MetadataDiagnostics


@pytest.fixture
def diagnostics():
    return MetadataDiagnostics()


@pytest.fixture
def doc_generator_with_diagnostics(diagnostics):
    return DocContentGenerator(diagnostics)


class TestMetadataDiagnostics:
    def test_empty_diagnostics(self, diagnostics):
        assert not diagnostics.has_issues()
        assert diagnostics.get_issue_count() == 0

    def test_records_different_issue_types(self, diagnostics):
        diagnostics.record_missing_metadata({"name": "comp1", "source_repo": "contrib"}, "receiver")
        diagnostics.record_missing_status({"name": "comp2", "source_repo": "contrib", "metadata": {}}, "processor")
        diagnostics.record_missing_stability(
            {"name": "comp3", "source_repo": "core", "metadata": {"status": {}}}, "exporter"
        )

        assert diagnostics.get_issue_count() == 3
        issue_types = {issue.issue_type for issue in diagnostics.issues}
        assert issue_types == {"missing_metadata", "missing_status", "missing_stability"}

    def test_get_issues_by_type(self, diagnostics):
        diagnostics.record_missing_metadata({"name": "comp1", "source_repo": "contrib"}, "receiver")
        diagnostics.record_missing_metadata({"name": "comp2", "source_repo": "contrib"}, "processor")
        diagnostics.record_missing_status({"name": "comp3", "source_repo": "core", "metadata": {}}, "exporter")

        by_type = diagnostics.get_issues_by_type()
        assert len(by_type["missing_metadata"]) == 2
        assert len(by_type["missing_status"]) == 1

    def test_generate_summary_no_issues(self, diagnostics):
        summary = diagnostics.generate_summary()
        assert "No metadata issues found" in summary

    def test_generate_summary_with_issues(self, diagnostics):
        diagnostics.record_missing_metadata({"name": "comp1", "source_repo": "contrib"}, "receiver")
        diagnostics.record_missing_status({"name": "comp2", "source_repo": "core", "metadata": {}}, "processor")

        summary = diagnostics.generate_summary()
        assert "Found 2 metadata issue(s)" in summary
        assert "## Issues by Type" in summary
        assert "receiver/comp1" in summary
        assert "processor/comp2" in summary

    def test_generate_github_issue_body(self, diagnostics):
        diagnostics.record_missing_metadata({"name": "comp1", "source_repo": "contrib"}, "receiver")
        diagnostics.record_missing_stability(
            {"name": "comp2", "source_repo": "core", "metadata": {"status": {}}}, "processor"
        )

        issue_body = diagnostics.generate_github_issue_body()
        assert "## Summary" in issue_body
        assert "2 components" in issue_body
        assert "## Affected Components" in issue_body
        assert "`comp1`" in issue_body
        assert "`comp2`" in issue_body


class TestDocContentGeneratorWithDiagnostics:
    def test_tracks_missing_metadata(self, doc_generator_with_diagnostics, diagnostics):
        component = {"name": "testcomp", "source_repo": "contrib"}
        result = doc_generator_with_diagnostics.get_stability_by_signal(None, component, "receiver")

        assert result == {}
        assert diagnostics.get_issue_count() == 1
        assert diagnostics.issues[0].issue_type == "missing_metadata"

    def test_tracks_missing_status(self, doc_generator_with_diagnostics, diagnostics):
        component = {"name": "testcomp", "source_repo": "contrib", "metadata": {}}
        result = doc_generator_with_diagnostics.get_stability_by_signal(component["metadata"], component, "receiver")

        assert result == {}
        assert diagnostics.get_issue_count() == 1
        assert diagnostics.issues[0].issue_type == "missing_status"

    def test_tracks_missing_stability(self, doc_generator_with_diagnostics, diagnostics):
        component = {"name": "testcomp", "source_repo": "contrib", "metadata": {"status": {}}}
        result = doc_generator_with_diagnostics.get_stability_by_signal(component["metadata"], component, "receiver")

        assert result == {}
        assert diagnostics.get_issue_count() == 1
        assert diagnostics.issues[0].issue_type == "missing_stability"

    def test_generate_table_with_missing_metadata(self, doc_generator_with_diagnostics, diagnostics):
        """Test that generating tables tracks all metadata issues."""
        components = [
            {
                "name": "goodcomp",
                "source_repo": "contrib",
                "metadata": {"status": {"stability": {"beta": ["traces"]}}},
            },
            {"name": "badcomp", "source_repo": "contrib"},  # Missing metadata
        ]

        table = doc_generator_with_diagnostics.generate_component_table("receiver", components)

        assert "goodcomp" in table
        assert "badcomp" in table
        assert diagnostics.get_issue_count() == 1
        assert diagnostics.issues[0].issue_type == "missing_metadata"
