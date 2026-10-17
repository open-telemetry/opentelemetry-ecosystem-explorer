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

"""Structured model snapshots: the stability of every named subject at one revision.

Handles both registry file formats upstream currently mixes (``groups:`` and ``definition/2``).
A subject is an attribute, metric, span, event or entity definition that names itself. References
(``ref:``) and groups used only for organisation are not subjects, so reorganising groups never
changes a snapshot. A subject's state is its ``stability`` value, ``deprecated`` when it carries a
``deprecated`` marker, or ``None`` when upstream states nothing: unknown stays unknown.
"""

import logging
from dataclasses import dataclass, field

import yaml

from .gitrepo import GitRepo

logger = logging.getLogger(__name__)

try:  # PyYAML's C loader is several times faster on the ~250 model files.
    _Loader = yaml.CSafeLoader
except AttributeError:  # pragma: no cover
    _Loader = yaml.SafeLoader

Subject = tuple[str, str]  # (kind, name)

_V2_SECTIONS = {
    "attributes": ("attribute", "key"),
    "metrics": ("metric", "name"),
    "spans": ("span", "type"),
    "events": ("event", "name"),
    "entities": ("entity", "type"),
}
_V1_NAME_FIELDS = {"metric": "metric_name", "span": "id", "event": "name", "entity": "name"}
_ID_PREFIXES = ("span.", "event.", "entity.", "metric.")


@dataclass
class Snapshot:
    subjects: dict[Subject, str | None] = field(default_factory=dict)
    files: dict[Subject, str] = field(default_factory=dict)
    # Organisational ids (attribute groups and refinements): a churn signal, never a milestone.
    structure: set[str] = field(default_factory=set)
    parsed: int = 0
    unparsed: list[str] = field(default_factory=list)


def namespace_of(name: str) -> str:
    return name.split(".", 1)[0]


def _state(item: dict) -> str | None:
    if item.get("deprecated"):
        return "deprecated"
    value = item.get("stability")
    return value if isinstance(value, str) else None


def _strip(name: str) -> str:
    for prefix in _ID_PREFIXES:
        if name.startswith(prefix):
            return name[len(prefix) :]
    return name


def _add(snapshot: Snapshot, kind: str, name: object, item: dict, path: str) -> None:
    if isinstance(name, str) and name:
        subject = (kind, name)
        snapshot.subjects[subject] = _state(item)
        snapshot.files[subject] = path


def _read_v1(doc: dict, snapshot: Snapshot, path: str) -> None:
    for group in doc.get("groups") or []:
        if not isinstance(group, dict):
            continue
        gtype = group.get("type", "attribute_group")
        prefix = group.get("prefix")
        for attribute in group.get("attributes") or []:
            if isinstance(attribute, dict) and "id" in attribute:  # a definition, not a ref
                name = f"{prefix}.{attribute['id']}" if prefix else attribute["id"]
                _add(snapshot, "attribute", name, attribute, path)
        field_name = _V1_NAME_FIELDS.get(gtype)
        if field_name:
            raw = group.get(field_name) or group.get("id")
            _add(snapshot, gtype, _strip(raw) if isinstance(raw, str) else raw, group, path)
        elif isinstance(group.get("id"), str):
            snapshot.structure.add(group["id"])


def _read_v2(doc: dict, snapshot: Snapshot, path: str) -> None:
    for section, (kind, key) in _V2_SECTIONS.items():
        for item in doc.get(section) or []:
            if isinstance(item, dict):
                _add(snapshot, kind, item.get(key), item, path)
    for section in ("attribute_groups", "span_refinements", "metric_refinements"):
        for item in doc.get(section) or []:
            if isinstance(item, dict) and isinstance(item.get("id"), str):
                snapshot.structure.add(item["id"])


def take_snapshot(repo: GitRepo, rev: str) -> Snapshot:
    """Parse every ``model/**/*.yaml`` at *rev*. Unparseable files are listed, never skipped silently."""
    snapshot = Snapshot()
    for path in repo.list_files(rev, "model"):
        if not path.endswith((".yaml", ".yml")):
            continue
        text = repo.show(rev, path)
        try:
            doc = yaml.load(text or "", Loader=_Loader)  # noqa: S506 - SafeLoader subclass
        except yaml.YAMLError:
            snapshot.unparsed.append(path)
            continue
        if not isinstance(doc, dict):
            continue  # an empty or non-registry YAML file
        snapshot.parsed += 1
        if str(doc.get("file_format", "")).endswith("/2"):
            _read_v2(doc, snapshot, path)
        else:
            _read_v1(doc, snapshot, path)
    return snapshot
