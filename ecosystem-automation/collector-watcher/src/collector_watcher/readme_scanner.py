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
"""Discovers and reads component README files from a local collector repository clone.

Unlike java-instrumentation-watcher, which fetches individual files remotely
over the GitHub API, collector-watcher already works against a full local
clone (see repository_manager.py), so discovering a component's README is a
direct filesystem check rather than a tree/blob API call.
"""

import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

README_FILENAME = "README.md"


def discover_component_readmes(repo_path: str, components: dict[str, list[dict[str, Any]]]) -> dict[str, str]:
    """
    Find and read README.md files for already-scanned components.

    Walks the same (component_type, subtype, name) entries ComponentScanner
    already produced, rather than re-deriving which directories count as real
    components. This can't drift from the scanner's own inclusion rules, and
    avoids a second, independent filesystem walk.

    Args:
        repo_path: Path to the cloned repository (the same one that was scanned)
        components: Output of ComponentScanner.scan_all_components()

    Returns:
        Dictionary mapping component name to README content. Components with
        no README.md, or whose README couldn't be read, are omitted rather
        than raising - a single unreadable file should never fail a sync.
    """
    base = Path(repo_path)
    readmes: dict[str, str] = {}

    for component_type, component_list in components.items():
        for component in component_list:
            name = component.get("name")
            if not name:
                continue

            subtype = component.get("subtype")
            component_dir = base / component_type / subtype / name if subtype else base / component_type / name

            readme_path = component_dir / README_FILENAME
            if not readme_path.is_file():
                continue

            try:
                readmes[name] = readme_path.read_text(encoding="utf-8")
            except OSError as e:
                logger.warning("Failed to read README for '%s' at %s: %s", name, readme_path, e)

    return readmes
