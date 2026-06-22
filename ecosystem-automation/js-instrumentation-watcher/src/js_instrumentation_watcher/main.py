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

"""Entry point for the JS instrumentation watcher."""

import logging
import os

from .instrumentation_sync import InstrumentationSync
from .inventory_manager import InventoryManager
from .repository_manager import JsContribRepositoryManager

logger = logging.getLogger(__name__)

REGISTRY_DIR = "ecosystem-registry/javascript"


def configure_logging() -> None:
    """Configure root logging for the watcher."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )


def main() -> None:
    """Main entry point for the JS instrumentation watcher."""
    configure_logging()

    base_dir = os.environ.get("JS_CONTRIB_REPOS_DIR", "tmp_repos")

    logger.info("Starting JS instrumentation watcher...")

    repo_manager = JsContribRepositoryManager(base_dir=base_dir)
    repo_path = repo_manager.setup()

    inventory_manager = InventoryManager(registry_dir=REGISTRY_DIR)

    sync = InstrumentationSync(
        repo_path=repo_path,
        inventory_manager=inventory_manager,
    )

    summary = sync.sync()

    logger.info("Sync complete: %s", summary)
