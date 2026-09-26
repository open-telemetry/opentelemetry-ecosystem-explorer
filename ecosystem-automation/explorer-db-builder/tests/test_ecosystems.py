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
"""Tests that the declared build topology still matches the writers that own it."""

from pathlib import Path

from explorer_db_builder import configuration_builder
from explorer_db_builder.collector_database_writer import CollectorDatabaseWriter
from explorer_db_builder.database_writer import DatabaseWriter
from explorer_db_builder.ecosystems import DATA_ROOT, ECOSYSTEMS, ecosystem_dir


def test_ecosystems_are_the_three_generated_directories():
    assert ECOSYSTEMS == ("collector", "configuration", "javaagent")


def test_every_ecosystem_lives_under_the_data_root():
    for ecosystem in ECOSYSTEMS:
        assert ecosystem_dir(ecosystem).parent == DATA_ROOT


def test_topology_matches_the_writers_that_own_the_directories():
    # These three defaults are the real source of truth for where output lands. If one moves and
    # ecosystems.py is not updated, emit_archives would silently stop archiving that pipeline.
    assert ecosystem_dir("javaagent") == Path(DatabaseWriter().database_dir)
    assert ecosystem_dir("collector") == Path(CollectorDatabaseWriter().database_dir)
    assert ecosystem_dir("configuration") == Path(configuration_builder.OUTPUT_DIR)


def test_ecosystem_dir_rejects_an_unknown_name():
    try:
        ecosystem_dir("nonsense")
    except ValueError as error:
        assert "nonsense" in str(error)
    else:
        raise AssertionError("expected ValueError")
