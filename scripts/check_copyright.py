# Copyright The OpenTelemetry Authors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
"""Script to check that all Python and JS/TS files have the copyright header."""

import logging
import os
import sys

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

PY_HEADER = "# Copyright The OpenTelemetry Authors"
JS_HEADER = "/*\n * Copyright The OpenTelemetry Authors"

EXCLUDE_DIRS = {".git", "node_modules", "__pycache__", ".venv", "dist", "build"}


def get_expected_header(filename: str) -> str | None:
    """Return the expected copyright header for the given file."""
    if filename.endswith(".py"):
        return PY_HEADER
    if filename.endswith((".js", ".ts", ".tsx")):
        return JS_HEADER
    return None


def has_copyright_header(filepath: str, expected: str) -> bool:
    """Check if the file starts with the expected copyright header."""
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()
    if content.startswith("#!"):  # skip shebang files
        return True
    return content.startswith(expected)


def find_missing_headers(root_dir: str) -> list[str]:
    """Walk the directory tree and return files missing the copyright header."""
    missing = []
    for root, dirs, files in os.walk(root_dir):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        for file in files:
            expected = get_expected_header(file)
            if expected is None:
                continue
            path = os.path.join(root, file)
            if not has_copyright_header(path, expected):
                missing.append(path)
    return missing


def main() -> None:
    missing = find_missing_headers(".")
    if missing:
        logger.error("Missing copyright header in:")
        for f in missing:
            logger.error("  %s", f)
        sys.exit(1)
    logger.info("All files have copyright header!")


if __name__ == "__main__":
    main()
