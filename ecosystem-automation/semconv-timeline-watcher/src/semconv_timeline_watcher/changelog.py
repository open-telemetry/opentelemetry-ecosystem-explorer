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

"""Parse upstream CHANGELOG sections and GenAI changelog fragments into reviewable entries."""

import re

_HEADING = re.compile(r"^##\s+v?(\d+\.\d+\.\d+)\b")
_ENTRY = re.compile(r"^- (?:`(?P<scope>[^`]+)`:\s*)?(?P<text>.*)$")
_REFERENCE = re.compile(r"\[#(\d+)\]\((https://[^)\s]+)\)")
_FRAGMENT = re.compile(r"^(?P<pr>\d+|\+[^.]*)\.(?P<type>[a-z]+)\.md$")


def _entry(lines: list[str]) -> dict | None:
    head = _ENTRY.match(lines[0])
    if not head:
        return None
    body = " ".join(line.strip() for line in lines if line.strip())
    scope = head["scope"] or ""
    return {
        "scope": sorted({s.strip() for s in scope.split(",") if s.strip()}),
        "text": head["text"].strip()[:300],
        "references": [{"number": int(n), "url": url} for n, url in _REFERENCE.findall(body)],
        "body": body[:600],
    }


def parse_changelog_section(changelog: str, version: str) -> list[dict] | None:
    """Entries of the ``## v{version}`` section, or None when the heading is absent."""
    lines = changelog.splitlines()
    start = next((i for i, line in enumerate(lines) if (m := _HEADING.match(line)) and m[1] == version), None)
    if start is None:
        return None
    entries, current = [], []
    for line in lines[start + 1 :]:
        if line.startswith("## "):
            break
        if line.startswith("- "):
            if current and (entry := _entry(current)):
                entries.append(entry)
            current = [line]
        elif current:
            current.append(line)
    if current and (entry := _entry(current)):
        entries.append(entry)
    return entries


def parse_fragment(name: str, text: str, repository: str) -> dict | None:
    """A GenAI towncrier fragment (``<pr>.<type>.md``) as an entry; orphan fragments have no PR."""
    match = _FRAGMENT.match(name)
    if not match:
        return None
    first = next((line.strip() for line in text.splitlines() if line.strip()), "")
    references = []
    if match["pr"].isdigit():
        references = [{"number": int(match["pr"]), "url": f"{repository}/pull/{match['pr']}"}]
    return {"scope": [], "text": first[:300], "references": references, "body": first[:600], "type": match["type"]}
