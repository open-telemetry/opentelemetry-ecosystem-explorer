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

"""Repository managers for the two monitored sources."""

import logging
import subprocess
from pathlib import Path

from watcher_common.repository_manager import _GIT, BaseRepositoryManager

logger = logging.getLogger(__name__)

SOURCES = {
    "semantic-conventions": {
        "url": "https://github.com/open-telemetry/semantic-conventions.git",
        "env": "SEMCONV_REPO_PATH",
    },
    "semantic-conventions-genai": {
        "url": "https://github.com/open-telemetry/semantic-conventions-genai.git",
        "env": "SEMCONV_GENAI_REPO_PATH",
    },
}
# Commit-mode sources are read at the remote default branch, resolved to a SHA before extraction.
HEAD_REF = "refs/remotes/origin/main"


class SemconvRepositoryManager(BaseRepositoryManager):
    """Clone (full history, all tags) or refresh one source. Never checks out or modifies the worktree."""

    def __init__(self, source_id: str, base_dir: str | None = None):
        super().__init__(base_dir)
        self.source_id = source_id

    def setup(self) -> Path:
        config = SOURCES[self.source_id]
        existing = self._get_repository_path(config["env"])  # an override is trusted as given
        if existing:
            return existing
        path = self.base_dir / self.source_id
        if not path.exists():
            self._clone_repository(config["url"], path)
        try:
            # --force so a tag that moved upstream is seen as moved; --prune drops deleted tags.
            subprocess.run(  # noqa: S603
                [_GIT, "fetch", "--tags", "--force", "--prune", "origin"],
                cwd=path,
                check=True,
                capture_output=True,
                text=True,
            )
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Failed to fetch {self.source_id}: {e.stderr}") from e
        return path
