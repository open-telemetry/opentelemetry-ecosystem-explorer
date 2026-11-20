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
"""Content-addressed database writer for the JavaScript instrumentation ecosystem."""

from explorer_db_builder.package_index_database_writer import PackageIndexDatabaseWriter


class JavascriptDatabaseWriter(PackageIndexDatabaseWriter):
    """Writes JavaScript packages to ``ecosystem-explorer/public/data/javascript``.

    The default directory is declared here, not derived from the ecosystem name, so that
    tests/test_ecosystems.py can check ecosystems.py against what each writer really writes.
    """

    def __init__(self, database_dir: str = "ecosystem-explorer/public/data/javascript") -> None:
        super().__init__("javascript", database_dir)
