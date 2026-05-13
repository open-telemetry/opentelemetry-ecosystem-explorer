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
"""Data models for V1 registry sync."""

from dataclasses import dataclass, field
from typing import Optional

STABILITY_PRIORITY = [
    "stable",
    "beta",
    "alpha",
    "development",
    "deprecated",
    "unmaintained",
]


@dataclass
class ComponentSyncData:
    """Fields extracted from V2 that are candidates for syncing into a V1 entry."""

    name: str
    component_type: str
    distribution: str
    display_name: Optional[str] = None
    description: Optional[str] = None
    stability: Optional[str] = None

    def proposed_changes(self) -> dict:
        """Return only the fields that have values, keyed by V1 field name."""
        changes: dict = {}
        if self.display_name is not None:
            changes["title"] = self.display_name
        if self.description is not None:
            changes["description"] = self.description
        if self.stability is not None:
            changes["stability"] = self.stability
        return changes


@dataclass
class V1SyncReport:
    """Report of proposed V1 changes derived from a single V2 registry snapshot."""

    version: str
    distribution: str
    components: list[ComponentSyncData] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "version": self.version,
            "distribution": self.distribution,
            "components": [
                {
                    "name": c.name,
                    "component_type": c.component_type,
                    "proposed_v1_changes": c.proposed_changes(),
                }
                for c in self.components
            ],
        }
