"""Tests for spelling fix functionality."""

from pathlib import Path
from unittest.mock import MagicMock, patch

from documentation_sync.fix_spelling import (
    update_cspell_list,
)


def test_update_frontmatter_with_existing_cspell_line(tmp_path):
    """Test updating frontmatter when cSpell:ignore line already exists."""
    # Create a test markdown file
    test_file = tmp_path / "test.md"
    original_content = """---
title: Test Page
description: Test description
weight: 100
cSpell:ignore: existingword anotherword
---

# Test Content

Some test content here.
"""
    test_file.write_text(original_content)

    new_words = {"newword", "zebra"}
    result = update_cspell_list(test_file, new_words)

    assert result is True

    updated_content = test_file.read_text()

    # Should contain all words in sorted order
    assert "cSpell:ignore: anotherword existingword newword zebra" in updated_content

    # Should preserve other frontmatter
    assert "title: Test Page" in updated_content
    assert "weight: 100" in updated_content

    # Should preserve content after frontmatter
    assert "# Test Content" in updated_content
    assert "Some test content here." in updated_content


def test_update_frontmatter_without_cspell_line(tmp_path):
    """Test adding cSpell:ignore line when it doesn't exist."""
    # Create a test markdown file without cSpell:ignore
    test_file = tmp_path / "test.md"
    original_content = """---
title: Test Page
description: Test description
weight: 100
---

# Test Content

Some test content here.
"""
    test_file.write_text(original_content)

    new_words = {"newword", "zebra"}
    result = update_cspell_list(test_file, new_words)

    assert result is True

    updated_content = test_file.read_text()

    # Should contain new cSpell:ignore line with sorted words
    assert "cSpell:ignore: newword zebra" in updated_content

    # Should preserve other frontmatter
    assert "title: Test Page" in updated_content
    assert "weight: 100" in updated_content

    # Should preserve content after frontmatter
    assert "# Test Content" in updated_content


def test_update_frontmatter_no_frontmatter(tmp_path):
    """Test handling file without frontmatter."""
    test_file = tmp_path / "test.md"
    original_content = """# Test Content

Some test content without frontmatter.
"""
    test_file.write_text(original_content)

    new_words = {"newword"}
    result = update_cspell_list(test_file, new_words)

    # Should return False since there's no frontmatter
    assert result is False

    # Content should be unchanged
    assert test_file.read_text() == original_content


@patch("documentation_sync.fix_spelling.subprocess.run")
def test_run_cspell_parses_output_correctly(mock_run):
    """Test that cspell output is parsed correctly."""
    from documentation_sync.fix_spelling import run_cspell

    mock_output = """content/en/docs/collector/components/receiver.md:25:4 - Unknown word (awslambdareceiver)
content/en/docs/collector/components/receiver.md:52:4 - Unknown word (googlecloudpubsubreceiver)
content/en/docs/collector/components/exporter.md:30:10 - Unknown word (kafkaexporter)
CSpell: Files checked: 5, Issues found: 3 in 2 files.
"""

    mock_run.return_value = MagicMock(stdout=mock_output, returncode=1)

    docs_repo = Path("/fake/path")
    result = run_cspell(docs_repo)

    assert "content/en/docs/collector/components/receiver.md" in result
    assert "content/en/docs/collector/components/exporter.md" in result

    receiver_words = result["content/en/docs/collector/components/receiver.md"]
    assert "awslambdareceiver" in receiver_words
    assert "googlecloudpubsubreceiver" in receiver_words

    exporter_words = result["content/en/docs/collector/components/exporter.md"]
    assert "kafkaexporter" in exporter_words
