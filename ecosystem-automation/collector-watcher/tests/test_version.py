"""Tests for version detection."""

from collector_watcher.version import Version


class TestVersion:
    def test_from_string_basic(self):
        v = Version.from_string("v0.112.0")
        assert v.major == 0
        assert v.minor == 112
        assert v.patch == 0
        assert not v.is_snapshot

    def test_from_string_without_v(self):
        v = Version.from_string("0.112.0")
        assert v.major == 0
        assert v.minor == 112
        assert v.patch == 0

    def test_from_string_snapshot(self):
        v = Version.from_string("v0.113.0-SNAPSHOT")
        assert v.major == 0
        assert v.minor == 113
        assert v.patch == 0
        assert v.is_snapshot

    def test_str(self):
        v = Version(0, 112, 0)
        assert str(v) == "v0.112.0"

    def test_str_snapshot(self):
        v = Version(0, 113, 0, is_snapshot=True)
        assert str(v) == "v0.113.0-SNAPSHOT"

    def test_comparison_major(self):
        v1 = Version(0, 112, 0)
        v2 = Version(1, 0, 0)
        assert v1 < v2

    def test_comparison_minor(self):
        v1 = Version(0, 112, 0)
        v2 = Version(0, 113, 0)
        assert v1 < v2

    def test_comparison_patch(self):
        v1 = Version(0, 112, 0)
        v2 = Version(0, 112, 1)
        assert v1 < v2

    def test_comparison_snapshot(self):
        v1 = Version(0, 113, 0, is_snapshot=True)
        v2 = Version(0, 113, 0, is_snapshot=False)
        assert v1 < v2

    def test_equality(self):
        v1 = Version(0, 112, 0)
        v2 = Version(0, 112, 0)
        assert v1 == v2

    def test_next_patch(self):
        v = Version(0, 112, 0)
        next_v = v.next_patch()
        assert next_v.major == 0
        assert next_v.minor == 112
        assert next_v.patch == 1

    def test_hash(self):
        v1 = Version(0, 112, 0)
        v2 = Version(0, 112, 0)
        v3 = Version(0, 112, 0, is_snapshot=True)

        # Same versions should have same hash
        assert hash(v1) == hash(v2)

        # Different versions should have different hash (usually)
        assert hash(v1) != hash(v3)

        # Should be usable in sets and as dict keys
        version_set = {v1, v2, v3}
        assert len(version_set) == 2  # v1 and v2 are the same
