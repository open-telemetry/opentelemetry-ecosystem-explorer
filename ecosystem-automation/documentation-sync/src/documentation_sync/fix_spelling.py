#!/usr/bin/env python3
"""
Fix spelling errors by updating cSpell:ignore in markdown front matter.

This script runs cspell to detect spelling errors in generated documentation,
identifies component names, and updates the cSpell:ignore line in the YAML
front matter of each affected file.
"""

import logging
import re
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)


def run_cspell(docs_repo_path: Path) -> dict[str, list[str]]:
    """
    Run cspell on collector component documentation.

    Args:
        docs_repo_path: Path to opentelemetry.io repository

    Returns:
        Dictionary mapping file paths to lists of misspelled words
    """
    component_docs = docs_repo_path / "content/en/docs/collector/components"

    cmd = [
        "npx",
        "cspell",
        "--no-progress",
        "-c",
        str(docs_repo_path / ".cspell.yml"),
        str(component_docs / "*.md"),
    ]

    try:
        result = subprocess.run(
            cmd,
            cwd=docs_repo_path,
            capture_output=True,
            text=True,
            check=False,  # Don't raise on non-zero exit (spelling errors)
        )

        # Parse cspell output to extract misspelled words
        # cspell output format: "filename:line:col - Unknown word (word)"
        misspellings: dict[str, list[str]] = {}
        pattern = r"^(.+?):(\d+):(\d+)\s+-\s+Unknown word \((.+?)\)"

        for line in result.stdout.split("\n"):
            match = re.match(pattern, line)
            if match:
                filepath = match.group(1)
                word = match.group(4)

                if filepath not in misspellings:
                    misspellings[filepath] = []
                misspellings[filepath].append(word)

        return misspellings

    except FileNotFoundError as e:
        raise RuntimeError("npx not found. Make sure Node.js is installed.") from e
    except Exception as e:
        raise RuntimeError(f"Error running cspell: {e}") from e


def update_cspell_list(file_path: Path, new_words: set[str]) -> int:
    """
    Update the cSpell:ignore line.

    Args:
        file_path: Path to markdown file
        new_words: Words to add to ignore list

    Returns:
        Number of words actually added (not already present), or -1 if file wasn't modified
    """
    with open(file_path, encoding="utf-8") as f:
        content = f.read()

    # Match front matter (between --- delimiters)
    frontmatter_pattern = r"^---\n(.*?)\n---\n"
    match = re.match(frontmatter_pattern, content, re.DOTALL)

    if not match:
        logger.warning(f"  ⚠️  No front matter found in {file_path.name}")
        return -1

    existing_section = match.group(1)
    existing_section_end = match.end()

    cspell_pattern = r"cSpell:ignore:\s*([^\n]+)"
    cspell_match = re.search(cspell_pattern, existing_section)

    if cspell_match:
        existing_words_str = cspell_match.group(1).strip()
        existing_words = set(existing_words_str.split())

        newly_added = new_words - existing_words

        # Combine and sort
        all_words = existing_words | new_words
        sorted_words = sorted(all_words, key=str.lower)

        new_cspell_line = f"cSpell:ignore: {' '.join(sorted_words)}"
        updated_frontmatter = existing_section.replace(cspell_match.group(0), new_cspell_line)
    else:
        # Add new cSpell:ignore line before the closing ---
        newly_added = new_words
        sorted_words = sorted(new_words, key=str.lower)
        new_cspell_line = f"cSpell:ignore: {' '.join(sorted_words)}"

        # Add the line at the end of the section (before the closing ---)
        updated_frontmatter = existing_section + f"\n{new_cspell_line}"

    # Reconstruct the content
    new_content = f"---\n{updated_frontmatter}\n---\n" + content[existing_section_end:]

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(new_content)

    return len(newly_added)


def fix_component_spelling(docs_repo_path: Path) -> dict[str, int]:
    """
    Fix spelling errors in documentation by adding component names to cSpell:ignore.

    Args:
        docs_repo_path: Path to opentelemetry.io repository

    Returns:
        Dictionary with 'files_updated' and 'words_added' counts

    Raises:
        RuntimeError: If cspell command fails
    """
    logger.info("Running cspell to detect spelling errors...")
    try:
        misspellings = run_cspell(docs_repo_path)
    except RuntimeError as e:
        logger.error(f"❌ {e}")
        logger.error("Skipping spelling fixes")
        return {"files_updated": 0, "words_added": 0}

    if not misspellings:
        logger.info("✓ No spelling errors found!")
        return {"files_updated": 0, "words_added": 0}

    logger.info(f"Found spelling errors in {len(misspellings)} file(s)")

    files_updated = 0
    total_words_added = 0

    for filepath, words in misspellings.items():
        file_path = Path(filepath)
        if not file_path.exists():
            file_path = docs_repo_path / filepath

        if not file_path.exists():
            logger.warning(f"  ⚠️  File not found: {filepath}")
            continue

        component_words = set(words)

        logger.info(f"\n{file_path.name}:")
        logger.info(f"  Processing {len(component_words)} words: {', '.join(sorted(component_words))}")

        newly_added = update_cspell_list(file_path, component_words)
        if newly_added >= 0:
            files_updated += 1
            total_words_added += newly_added
            if newly_added < len(component_words):
                logger.info(f"  ({len(component_words) - newly_added} already in ignore list)")

    if files_updated > 0:
        logger.info(f"\n✓ Updated {files_updated} file(s), added {total_words_added} words total")

        logger.info("Verifying spelling errors are fixed...")
        try:
            remaining = run_cspell(docs_repo_path)
        except RuntimeError as e:
            logger.warning(f"Could not verify fixes: {e}")
            return {"files_updated": files_updated, "words_added": total_words_added}

        if remaining:
            remaining_count = sum(len(words) for words in remaining.values())
            logger.warning(f"⚠️  {remaining_count} spelling errors remain in {len(remaining)} file(s)")
            logger.warning("These may be legitimate typos or non-component words.")
        else:
            logger.info("✓ All component name spelling errors fixed!")
    else:
        logger.warning("⚠️  No files were updated")

    return {"files_updated": files_updated, "words_added": total_words_added}
