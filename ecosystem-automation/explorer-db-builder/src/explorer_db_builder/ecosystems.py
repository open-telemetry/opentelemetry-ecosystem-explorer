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
"""Where each ecosystem's generated database lives.

The three writers each carry their own output directory as a default argument, and main.py carries
the list of pipeline names. This module is the one place the archiving side reads that topology
from, and tests/test_ecosystems.py fails if the two ever drift.
"""

from pathlib import Path

# Relative to the repository root, matching the three writers' own defaults. The builder is always
# invoked from the root; emit_archives reports the expected working directory if it is not.
DATA_ROOT = Path("ecosystem-explorer/public/data")

ECOSYSTEMS = ("collector", "configuration", "javaagent")


def ecosystem_dir(ecosystem: str) -> Path:
    """Locate one ecosystem's generated output.

    Args:
        ecosystem: One of ECOSYSTEMS.

    Returns:
        The directory the matching pipeline writes into.

    Raises:
        ValueError: If the name is not a known ecosystem.
    """
    if ecosystem not in ECOSYSTEMS:
        raise ValueError(f"Unknown ecosystem {ecosystem!r}; expected one of {', '.join(ECOSYSTEMS)}")
    return DATA_ROOT / ecosystem
