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
"""Tests for telemetry_when_corrections."""

import pytest
from explorer_db_builder.telemetry_when_corrections import apply_telemetry_when_corrections
from semantic_version import Version

# --- Shared constants ----------------------------------------------------------

_SERVLET_TEST_COND = "otel.instrumentation.servlet.experimental.capture-request-parameters=test-parameter"
_CONTROLLER_WHEN = "otel.instrumentation.common.experimental.controller-telemetry.enabled=true"
_RECEIVE_WHEN = "otel.instrumentation.messaging.experimental.receive-telemetry.enabled=true"
_PULSAR_COMPOUND_WHEN = (
    "otel.instrumentation.messaging.experimental.receive-telemetry.enabled=true,"
    "otel.instrumentation.pulsar.experimental-span-attributes=true"
)

# --- Builder helpers -----------------------------------------------------------


def _span(span_kind, *attr_names):
    """Build a minimal span dict."""
    return {
        "span_kind": span_kind,
        "attributes": [{"name": n} for n in attr_names],
    }


def _metric(name):
    """Build a minimal metric dict."""
    return {"name": name}


def _block(when, spans=(), metrics=()):
    """Build a telemetry block dict, omitting empty lists."""
    block = {"when": when}
    if spans:
        block["spans"] = list(spans)
    if metrics:
        block["metrics"] = list(metrics)
    return block


def _item(name, *telemetry_blocks):
    """Build a minimal instrumentation item dict."""
    return {"name": name, "telemetry": list(telemetry_blocks)}


def _inventory(*items, key="libraries"):
    return {key: list(items)}


# --- Test class ----------------------------------------------------------------


class TestApplyTelemetryWhenCorrections:
    def test_ignore_folds_artifact_block_into_default(self):
        """The servlet test-artifact condition is relabeled to default.

        When a default block already exists the ignored block's signals are
        merged in, and duplicates are dropped.
        """
        server_span = _span("SERVER", "server.address", "server.port")
        duplicate_span = _span("SERVER", "server.address", "server.port")
        metric = _metric("http.server.request.duration")

        # Default block already has the SERVER span; the artifact block duplicates it.
        inventory = _inventory(
            _item(
                "servlet-5.0",
                _block("default", spans=[server_span]),
                _block(_SERVLET_TEST_COND, spans=[duplicate_span], metrics=[metric]),
            )
        )

        apply_telemetry_when_corrections(inventory, Version("2.28.0"))

        telemetry = inventory["libraries"][0]["telemetry"]
        when_values = [b["when"] for b in telemetry]
        assert _SERVLET_TEST_COND not in when_values, "artifact block should be removed"

        default_block = next(b for b in telemetry if b["when"] == "default")
        # Duplicate SERVER span must NOT be added again.
        assert len(default_block.get("spans", [])) == 1, "dedup: only one SERVER span"
        # The metric was new → merged in.
        assert any(m["name"] == "http.server.request.duration" for m in default_block.get("metrics", []))

    def test_correction_moves_span_before_cutoff(self):
        """A misclassified INTERNAL span is moved from default to its correct when-condition.

        Tested with jaxrs-1.0 at version 2.27.0 (before the 2.28.0 cutoff).
        """
        internal_span = _span("INTERNAL", "code.function", "code.namespace")
        inventory = _inventory(_item("jaxrs-1.0", _block("default", spans=[internal_span])))

        apply_telemetry_when_corrections(inventory, Version("2.27.0"))

        telemetry = inventory["libraries"][0]["telemetry"]
        when_values = [b["when"] for b in telemetry]

        assert "default" not in when_values, "empty default block should be dropped"
        assert _CONTROLLER_WHEN in when_values

        controller_block = next(b for b in telemetry if b["when"] == _CONTROLLER_WHEN)
        assert any(s["span_kind"] == "INTERNAL" for s in controller_block.get("spans", []))

    def test_correction_skips_at_and_after_cutoff(self):
        """Corrections with applies_to_versions_before are no-ops at and after the cutoff.

        At 2.28.0 the registry data is already correct — the correction must not clobber it.
        """
        internal_span = _span("INTERNAL", "code.function", "code.namespace")
        inventory = _inventory(_item("jaxrs-1.0", _block("default", spans=[internal_span])))

        # Exact cutoff version.
        apply_telemetry_when_corrections(inventory, Version("2.28.0"))

        telemetry = inventory["libraries"][0]["telemetry"]
        when_values = [b["when"] for b in telemetry]

        assert "default" in when_values, "default block should be unchanged"
        assert _CONTROLLER_WHEN not in when_values, "no controller-telemetry block should be created"

    def test_ignore_then_correction_ordering_for_servlet(self):
        """ignore_conditions runs before corrections — critical for the servlet-5.0 case.

        In v2.28.0 the entire default block (INTERNAL + SERVER spans + metric) was filed
        under the test-artifact condition.  Without ignore_conditions running first the
        correction would find no default block and silently skip the INTERNAL span.
        """
        internal_span = _span("INTERNAL", "code.function", "code.namespace")
        server_span = _span("SERVER", "server.address", "server.port")
        metric = _metric("http.server.request.duration")

        # No default block — everything is under the test-artifact condition.
        inventory = _inventory(
            _item(
                "servlet-5.0",
                _block(_SERVLET_TEST_COND, spans=[internal_span, server_span], metrics=[metric]),
            )
        )

        apply_telemetry_when_corrections(inventory, Version("2.28.0"))

        telemetry = inventory["libraries"][0]["telemetry"]
        when_values = [b["when"] for b in telemetry]

        assert _SERVLET_TEST_COND not in when_values, "artifact block should be removed"

        # SERVER span and metric stay in default; INTERNAL moves to controller-telemetry.
        default_block = next((b for b in telemetry if b["when"] == "default"), None)
        assert default_block is not None, "default block should exist after ignore step"
        assert any(s["span_kind"] == "SERVER" for s in default_block.get("spans", []))
        assert not any(s["span_kind"] == "INTERNAL" for s in default_block.get("spans", []))

        controller_block = next((b for b in telemetry if b["when"] == _CONTROLLER_WHEN), None)
        assert controller_block is not None, "controller-telemetry block should be created"
        assert any(s["span_kind"] == "INTERNAL" for s in controller_block.get("spans", []))

    def test_correction_moves_metric(self):
        """Metric corrections match by name and move to the correct compound when-condition.

        Tested with pulsar-2.8 messaging.publish.duration at version 2.27.0.
        """
        publish_metric = _metric("messaging.publish.duration")
        inventory = _inventory(_item("pulsar-2.8", _block("default", metrics=[publish_metric])))

        apply_telemetry_when_corrections(inventory, Version("2.27.0"))

        telemetry = inventory["libraries"][0]["telemetry"]
        when_values = [b["when"] for b in telemetry]

        assert "default" not in when_values, "empty default block should be dropped"
        assert _PULSAR_COMPOUND_WHEN in when_values

        pulsar_block = next(b for b in telemetry if b["when"] == _PULSAR_COMPOUND_WHEN)
        assert any(m["name"] == "messaging.publish.duration" for m in pulsar_block.get("metrics", []))

    def test_correction_drops_empty_from_block_and_creates_to_block(self):
        """After the last signal is moved out the from_when block is dropped.

        The to_when block is created fresh when it did not previously exist.
        """
        internal_span = _span("INTERNAL", "code.function", "code.namespace")
        # Default block with exactly one span — the one targeted by jaxrs-1.0 correction.
        inventory = _inventory(_item("jaxrs-1.0", _block("default", spans=[internal_span])))

        apply_telemetry_when_corrections(inventory, Version("2.27.0"))

        telemetry = inventory["libraries"][0]["telemetry"]
        when_values = [b["when"] for b in telemetry]

        assert "default" not in when_values, "empty default block must be dropped"
        assert _CONTROLLER_WHEN in when_values, "to_when block must be created"

    def test_returns_same_inventory_object(self):
        """The function mutates in place and returns the same object."""
        inventory = {"libraries": []}
        assert apply_telemetry_when_corrections(inventory, Version("2.27.0")) is inventory

    def test_handles_missing_telemetry_and_collections(self):
        """Missing libraries/custom, None lists, and absent telemetry do not raise."""
        apply_telemetry_when_corrections({}, Version("2.27.0"))
        apply_telemetry_when_corrections({"libraries": None, "custom": None}, Version("2.27.0"))
        apply_telemetry_when_corrections({"libraries": [{"name": "a"}, {"name": "jaxrs-1.0"}]}, Version("2.27.0"))
        apply_telemetry_when_corrections({"libraries": [{"name": "jaxrs-1.0", "telemetry": None}]}, Version("2.27.0"))

    def test_skips_instrumentation_not_in_inventory(self):
        """A correction for an instrumentation absent from the inventory is silently skipped."""
        inventory = _inventory(_item("unrelated-lib", _block("default", spans=[_span("SERVER")])))

        # Should not raise or modify the unrelated-lib item.
        apply_telemetry_when_corrections(inventory, Version("2.27.0"))

        telemetry = inventory["libraries"][0]["telemetry"]
        assert len(telemetry) == 1
        assert telemetry[0]["when"] == "default"

    def test_skips_non_dict_items(self):
        """Non-dict items in the libraries/custom lists are silently ignored."""
        inventory = {"libraries": ["not-a-dict", None], "custom": ["also-not-a-dict"]}
        # Should not raise.
        apply_telemetry_when_corrections(inventory, Version("2.27.0"))

    def test_multiple_corrections_for_same_instrumentation(self):
        """Both CONSUMER and PRODUCER spans are corrected for jms-1.1."""
        consumer_attrs = (
            "messaging.destination.name",
            "messaging.destination.temporary",
            "messaging.message.id",
            "messaging.operation",
            "messaging.system",
        )
        producer_attrs = consumer_attrs  # jms-1.1 PRODUCER has the same attribute set

        consumer_span = _span("CONSUMER", *consumer_attrs)
        producer_span = _span("PRODUCER", *producer_attrs)

        inventory = _inventory(_item("jms-1.1", _block("default", spans=[consumer_span, producer_span])))

        apply_telemetry_when_corrections(inventory, Version("2.27.0"))

        telemetry = inventory["libraries"][0]["telemetry"]
        when_values = [b["when"] for b in telemetry]

        assert "default" not in when_values, "empty default block should be dropped"
        assert _RECEIVE_WHEN in when_values

        receive_block = next(b for b in telemetry if b["when"] == _RECEIVE_WHEN)
        span_kinds = {s["span_kind"] for s in receive_block.get("spans", [])}
        assert "CONSUMER" in span_kinds
        assert "PRODUCER" in span_kinds

    @pytest.mark.parametrize(
        "version_str",
        ["2.28.0", "2.28.1", "3.0.0"],
    )
    def test_jms_correction_skipped_at_and_after_cutoff(self, version_str):
        """jms-1.1 messaging corrections are no-ops at and after 2.28.0."""
        consumer_attrs = (
            "messaging.destination.name",
            "messaging.destination.temporary",
            "messaging.message.id",
            "messaging.operation",
            "messaging.system",
        )
        consumer_span = _span("CONSUMER", *consumer_attrs)
        inventory = _inventory(_item("jms-1.1", _block("default", spans=[consumer_span])))

        apply_telemetry_when_corrections(inventory, Version(version_str))

        telemetry = inventory["libraries"][0]["telemetry"]
        assert telemetry[0]["when"] == "default", "default block should be unchanged"
        assert _RECEIVE_WHEN not in [b["when"] for b in telemetry]
