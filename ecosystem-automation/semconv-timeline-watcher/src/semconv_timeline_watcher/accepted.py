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

"""Read the accepted history (``timeline.json``) that the watcher builds on. Never writes it."""

import json
from dataclasses import dataclass, field
from pathlib import Path

TIMELINE_PATH = Path("ecosystem-explorer/public/data/semantic-conventions/timeline.json")


@dataclass
class AcceptedHistory:
    sources: dict[str, dict] = field(default_factory=dict)
    releases: dict[str, dict] = field(default_factory=dict)
    lanes: list[dict] = field(default_factory=list)
    events: dict[str, dict] = field(default_factory=dict)

    def reviewed_through(self, source_id: str) -> dict | None:
        """The accepted-history coverage mark of a source (``{tag?, commit}``), if it has one."""
        return self.sources.get(source_id, {}).get("reviewedThrough")

    def accepted_release_keys(self, source_id: str) -> set[str]:
        return {key for key in self.releases if key.startswith(f"{source_id}@")}


def load_accepted(path: Path | str = TIMELINE_PATH) -> AcceptedHistory:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return AcceptedHistory(
        sources={s["id"]: s for s in data["sources"]},
        releases={r["key"]: r for r in data["releases"]},
        lanes=data["lanes"],
        events={e["id"]: e for e in data["events"]},
    )
