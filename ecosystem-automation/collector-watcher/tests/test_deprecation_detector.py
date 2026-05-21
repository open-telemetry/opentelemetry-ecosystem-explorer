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
"""Tests for deprecation detector."""

import pytest
from collector_watcher.deprecation_detector import DeprecationDetector
from semantic_version import Version


@pytest.fixture
def detector():
    return DeprecationDetector()


@pytest.fixture
def previous_version():
    return Version("0.139.0")


@pytest.fixture
def current_version():
    return Version("0.140.0")


@pytest.fixture
def previous_components():
    return {
        "receiver": [
            {
                "name": "otlpreceiver",
                "source_repo": "core",
                "distributions": ["core"],
                "subtype": None,
            },
            {
                "name": "examplereceiver",
                "source_repo": "core",
                "distributions": ["core"],
                "subtype": None,
            },
        ],
        "processor": [
            {
                "name": "batchprocessor",
                "source_repo": "core",
                "distributions": ["core"],
                "subtype": None,
            },
        ],
        "exporter": [],
        "connector": [],
        "extension": [],
    }


@pytest.fixture
def current_components():
    return {
        "receiver": [
            {
                "name": "otlpreceiver",
                "source_repo": "core",
                "distributions": ["core"],
                "subtype": None,
            },
        ],
        "processor": [
            {
                "name": "batchprocessor",
                "source_repo": "core",
                "distributions": ["core"],
                "subtype": None,
            },
        ],
        "exporter": [],
        "connector": [],
        "extension": [],
    }


def test_detect_deprecated_with_removal(
    detector, previous_version, current_version, previous_components, current_components
):
    deprecated = detector.detect_deprecated(
        previous_version=previous_version,
        previous_components=previous_components,
        current_version=current_version,
        current_components=current_components,
    )

    assert len(deprecated["receiver"]) == 1
    assert deprecated["receiver"][0]["name"] == "examplereceiver"
    assert deprecated["receiver"][0]["last_version"] == "v0.139.0"
    assert deprecated["receiver"][0]["deprecated_in_version"] == "v0.140.0"
    assert deprecated["receiver"][0]["source_repo"] == "core"
    assert deprecated["receiver"][0]["distributions"] == ["core"]
    assert deprecated["receiver"][0]["subtype"] is None

    assert len(deprecated["processor"]) == 0
    assert len(deprecated["exporter"]) == 0


def test_detect_deprecated_no_previous_version(detector, current_version, current_components):
    deprecated = detector.detect_deprecated(
        previous_version=None,
        previous_components={},
        current_version=current_version,
        current_components=current_components,
    )

    for component_type in deprecated:
        assert len(deprecated[component_type]) == 0


def test_detect_deprecated_no_removals(detector, previous_version, current_version, previous_components):
    deprecated = detector.detect_deprecated(
        previous_version=previous_version,
        previous_components=previous_components,
        current_version=current_version,
        current_components=previous_components,
    )

    for component_type in deprecated:
        assert len(deprecated[component_type]) == 0


def test_detect_deprecated_with_new_components(detector, previous_version, current_version):
    previous = {
        "receiver": [
            {
                "name": "otlpreceiver",
                "source_repo": "core",
                "distributions": ["core"],
                "subtype": None,
            },
        ],
        "processor": [],
        "exporter": [],
        "connector": [],
        "extension": [],
    }

    current = {
        "receiver": [
            {
                "name": "otlpreceiver",
                "source_repo": "core",
                "distributions": ["core"],
                "subtype": None,
            },
            {
                "name": "newreceiver",
                "source_repo": "core",
                "distributions": ["core"],
                "subtype": None,
            },
        ],
        "processor": [],
        "exporter": [],
        "connector": [],
        "extension": [],
    }

    deprecated = detector.detect_deprecated(
        previous_version=previous_version,
        previous_components=previous,
        current_version=current_version,
        current_components=current,
    )

    assert len(deprecated["receiver"]) == 0


def test_detect_deprecated_multiple_component_types(detector, previous_version, current_version):
    previous = {
        "receiver": [
            {
                "name": "receiver1",
                "source_repo": "core",
                "distributions": ["core"],
                "subtype": None,
            },
        ],
        "processor": [
            {
                "name": "processor1",
                "source_repo": "core",
                "distributions": ["core"],
                "subtype": None,
            },
        ],
        "exporter": [
            {
                "name": "exporter1",
                "source_repo": "contrib",
                "distributions": ["contrib"],
                "subtype": None,
            },
        ],
        "connector": [],
        "extension": [],
    }

    current = {
        "receiver": [],
        "processor": [],
        "exporter": [],
        "connector": [],
        "extension": [],
    }

    deprecated = detector.detect_deprecated(
        previous_version=previous_version,
        previous_components=previous,
        current_version=current_version,
        current_components=current,
    )

    assert len(deprecated["receiver"]) == 1
    assert len(deprecated["processor"]) == 1
    assert len(deprecated["exporter"]) == 1
    assert deprecated["receiver"][0]["name"] == "receiver1"
    assert deprecated["processor"][0]["name"] == "processor1"
    assert deprecated["exporter"][0]["name"] == "exporter1"


def test_create_deprecated_component(detector, previous_version, current_version):
    component = {
        "name": "examplereceiver",
        "source_repo": "core",
        "distributions": ["core"],
        "subtype": None,
    }

    deprecated = detector._create_deprecated_component(component, previous_version, current_version)

    assert deprecated["name"] == "examplereceiver"
    assert deprecated["last_version"] == "v0.139.0"
    assert deprecated["deprecated_in_version"] == "v0.140.0"
    assert deprecated["source_repo"] == "core"
    assert deprecated["distributions"] == ["core"]
    assert deprecated["subtype"] is None


def test_detect_deprecated_subtype_removal(detector, previous_version, current_version):
    """A component removed from one subtype should be detected even if the same
    name still exists under a different subtype."""
    previous = {
        "receiver": [],
        "processor": [],
        "exporter": [],
        "connector": [],
        "extension": [
            {
                "name": "zipkin",
                "source_repo": "contrib",
                "distributions": ["contrib"],
                "subtype": "encoding",
            },
            {
                "name": "zipkin",
                "source_repo": "contrib",
                "distributions": ["contrib"],
                "subtype": "storage",
            },
        ],
    }

    current = {
        "receiver": [],
        "processor": [],
        "exporter": [],
        "connector": [],
        "extension": [
            {
                "name": "zipkin",
                "source_repo": "contrib",
                "distributions": ["contrib"],
                "subtype": "storage",
            },
        ],
    }

    deprecated = detector.detect_deprecated(
        previous_version=previous_version,
        previous_components=previous,
        current_version=current_version,
        current_components=current,
    )

    assert len(deprecated["extension"]) == 1
    assert deprecated["extension"][0]["name"] == "zipkin"
    assert deprecated["extension"][0]["subtype"] == "encoding"


def test_detect_deprecated_same_name_different_subtype_no_false_positive(detector, previous_version, current_version):
    """When a component exists under the same name but its subtype changes,
    only the removed subtype entry should be flagged, not the surviving one."""
    previous = {
        "receiver": [],
        "processor": [],
        "exporter": [],
        "connector": [],
        "extension": [
            {
                "name": "otlp",
                "source_repo": "core",
                "distributions": ["core"],
                "subtype": "encoding",
            },
        ],
    }

    current = {
        "receiver": [],
        "processor": [],
        "exporter": [],
        "connector": [],
        "extension": [
            {
                "name": "otlp",
                "source_repo": "core",
                "distributions": ["core"],
                "subtype": "encoding",
            },
        ],
    }

    deprecated = detector.detect_deprecated(
        previous_version=previous_version,
        previous_components=previous,
        current_version=current_version,
        current_components=current,
    )

    assert len(deprecated["extension"]) == 0
