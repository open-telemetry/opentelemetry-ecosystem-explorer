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


def update_cspell_list(file_path: Path, new_words: set[str]) -> bool:
    """
    Update the cSpell:ignore line.

    Args:
        file_path: Path to markdown file
        new_words: Words to add to ignore list

    Returns:
        True if file was modified
    """
    with open(file_path) as f:
        content = f.read()

    # Match heading section (between --- delimiters)
    frontmatter_pattern = r"^---\n(.*?)\n---\n"
    match = re.match(frontmatter_pattern, content, re.DOTALL)

    if not match:
        print(f"  ⚠️  No heading section found in {file_path.name}")
        return False

    existing_section = match.group(1)
    existing_section_end = match.end()

    cspell_pattern = r"cSpell:ignore:\s*(.+)"
    cspell_match = re.search(cspell_pattern, existing_section)

    if cspell_match:
        existing_words_str = cspell_match.group(1).strip()
        existing_words = set(existing_words_str.split())

        # Combine and sort
        all_words = existing_words | new_words
        sorted_words = sorted(all_words, key=str.lower)

        new_cspell_line = f"cSpell:ignore: {' '.join(sorted_words)}"
        new_cspell_list = existing_section.replace(cspell_match.group(0), new_cspell_line)
    else:
        # Add new cSpell:ignore line before the closing ---
        sorted_words = sorted(new_words, key=str.lower)
        new_cspell_line = f"cSpell:ignore: {' '.join(sorted_words)}"

        # Add the line at the end of the section (before the closing ---)
        new_cspell_list = existing_section + f"\n{new_cspell_line}"

    # Reconstruct the content
    new_content = f"---\n{new_cspell_list}\n---\n" + content[existing_section_end:]

    with open(file_path, "w") as f:
        f.write(new_content)

    return True


def fix_component_spelling(docs_repo_path: Path) -> dict[str, int]:
    """
    Fix spelling errors in documentation by adding component names to cSpell:ignore.

    Args:
        docs_repo_path: Path to opentelemetry.io repository
        inventory_path: Path to collector inventory directory

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

        if not component_words:
            logger.info(f"\n{file_path.name}:")
            logger.info("  ⚠️  No component names found in spelling errors")
            logger.info(f"  Words: {', '.join(sorted(set(words)))}")
            continue

        logger.info(f"\n{file_path.name}:")
        logger.info(f"  Adding {len(component_words)} words: {', '.join(sorted(component_words))}")

        if update_cspell_list(file_path, component_words):
            files_updated += 1
            total_words_added += len(component_words)

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
