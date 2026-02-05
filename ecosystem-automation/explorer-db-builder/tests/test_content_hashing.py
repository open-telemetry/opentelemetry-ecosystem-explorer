"""Tests for content hashing utilities."""

import pytest
from explorer_db_builder.content_hashing import content_hash, normalize_for_hashing


class TestNormalizeForHashing:
    def test_normalize_none(self):
        assert normalize_for_hashing(None) is None

    def test_normalize_primitives(self):
        """Primitive types are preserved."""
        assert normalize_for_hashing(42) == 42
        assert normalize_for_hashing(3.14) == 3.14
        assert normalize_for_hashing("hello") == "hello"
        assert normalize_for_hashing(True) is True
        assert normalize_for_hashing(False) is False

    def test_normalize_list(self):
        """Lists are processed recursively."""
        input_list = [3, 1, 2, {"b": 2, "a": 1}]
        expected = [3, 1, 2, {"a": 1, "b": 2}]
        assert normalize_for_hashing(input_list) == expected

    def test_normalize_dict_sorts_keys(self):
        """Dictionary keys are sorted alphabetically."""
        input_dict = {"z": 1, "a": 2, "m": 3}
        result = normalize_for_hashing(input_dict)
        assert list(result.keys()) == ["a", "m", "z"]
        assert result == {"a": 2, "m": 3, "z": 1}

    def test_normalize_nested_dicts(self):
        """Nested dictionaries are processed recursively."""
        input_dict = {
            "outer": {"z": 1, "a": 2},
            "array": [{"b": 2, "a": 1}],
        }
        expected = {
            "array": [{"a": 1, "b": 2}],
            "outer": {"a": 2, "z": 1},
        }
        assert normalize_for_hashing(input_dict) == expected

    def test_normalize_empty_structures(self):
        """Empty structures are handled correctly."""
        assert normalize_for_hashing([]) == []
        assert normalize_for_hashing({}) == {}

    def test_normalize_complex_nested(self):
        """Complex nested structures are normalized."""
        input_data = {
            "z": [{"c": 3, "a": 1}, {"b": 2}],
            "a": {"nested": {"z": 1, "a": 2}},
        }
        result = normalize_for_hashing(input_data)
        assert list(result.keys()) == ["a", "z"]
        assert list(result["a"]["nested"].keys()) == ["a", "z"]
        assert list(result["z"][0].keys()) == ["a", "c"]

    def test_normalize_non_serializable_type(self):
        """Non-serializable types raise TypeError."""
        with pytest.raises(TypeError, match="not JSON serializable"):
            normalize_for_hashing(object())

        with pytest.raises(TypeError, match="not JSON serializable"):
            normalize_for_hashing({"key": lambda x: x})

        with pytest.raises(TypeError, match="not JSON serializable"):
            normalize_for_hashing([1, 2, {3, 4}])


class TestContentHash:
    def test_hash_simple_dict(self):
        """Simple dictionaries produce consistent hashes."""
        data = {"name": "test", "value": 42}
        hash_value = content_hash(data)
        assert isinstance(hash_value, str)
        assert len(hash_value) == 12
        assert hash_value.isalnum()

    def test_hash_consistency(self):
        """Same data produces same hash."""
        data = {"name": "test", "value": 42}
        hash1 = content_hash(data)
        hash2 = content_hash(data)
        assert hash1 == hash2

    def test_hash_key_order_independence(self):
        """Key order doesn't affect hash."""
        data1 = {"a": 1, "b": 2, "c": 3}
        data2 = {"c": 3, "a": 1, "b": 2}
        data3 = {"b": 2, "c": 3, "a": 1}
        assert content_hash(data1) == content_hash(data2)
        assert content_hash(data2) == content_hash(data3)

    def test_hash_nested_key_order_independence(self):
        """Nested key order doesn't affect hash."""
        data1 = {"outer": {"z": 1, "a": 2}, "value": 42}
        data2 = {"value": 42, "outer": {"a": 2, "z": 1}}
        assert content_hash(data1) == content_hash(data2)

    def test_hash_different_data_produces_different_hash(self):
        """Different data produces different hashes."""
        data1 = {"name": "test1"}
        data2 = {"name": "test2"}
        assert content_hash(data1) != content_hash(data2)

    def test_hash_lists(self):
        """Lists can be hashed."""
        data = [1, 2, 3, {"a": 1}]
        hash_value = content_hash(data)
        assert len(hash_value) == 12

    def test_hash_list_order_matters(self):
        """List order affects hash."""
        data1 = [1, 2, 3]
        data2 = [3, 2, 1]
        assert content_hash(data1) != content_hash(data2)

    def test_hash_primitives(self):
        """Primitive types can be hashed."""
        assert len(content_hash("string")) == 12
        assert len(content_hash(42)) == 12
        assert len(content_hash(3.14)) == 12
        assert len(content_hash(True)) == 12

    def test_hash_none_raises_error(self):
        """Hashing None raises ValueError."""
        with pytest.raises(ValueError, match="Cannot hash None value"):
            content_hash(None)

    def test_hash_non_serializable_raises_error(self):
        """Non-serializable types raise TypeError."""
        with pytest.raises(TypeError, match="not JSON serializable"):
            content_hash({"key": object()})

    def test_hash_complex_structure(self):
        """Complex realistic structure produces valid hash."""
        data = {
            "name": "akka-http",
            "version": "1.0",
            "metadata": {
                "description": "Instrumentation for Akka HTTP",
                "tags": ["http", "akka"],
            },
            "dependencies": [
                {"name": "dep1", "version": "1.0"},
                {"name": "dep2", "version": "2.0"},
            ],
        }
        hash_value = content_hash(data)
        assert len(hash_value) == 12

        # Verify consistency with reordered structure
        data_reordered = {
            "dependencies": [
                {"version": "1.0", "name": "dep1"},
                {"version": "2.0", "name": "dep2"},
            ],
            "version": "1.0",
            "name": "akka-http",
            "metadata": {
                "tags": ["http", "akka"],
                "description": "Instrumentation for Akka HTTP",
            },
        }
        assert content_hash(data) == content_hash(data_reordered)

    def test_hash_empty_dict(self):
        """Empty dict produces valid hash."""
        hash_value = content_hash({})
        assert len(hash_value) == 12
        assert hash_value == content_hash({})

    def test_hash_empty_list(self):
        """Empty list produces valid hash."""
        hash_value = content_hash([])
        assert len(hash_value) == 12
        assert hash_value == content_hash([])

    def test_hash_whitespace_in_values(self):
        """Whitespace in string values affects hash."""
        data1 = {"key": "value"}
        data2 = {"key": " value"}
        data3 = {"key": "value "}
        assert content_hash(data1) != content_hash(data2)
        assert content_hash(data1) != content_hash(data3)
        assert content_hash(data2) != content_hash(data3)
