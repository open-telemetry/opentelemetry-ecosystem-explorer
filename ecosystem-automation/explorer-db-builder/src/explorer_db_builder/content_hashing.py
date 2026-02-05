"""Content hashing utilities for generating stable hashes of data structures."""

import hashlib
import json
from typing import Any


def normalize_for_hashing(obj: Any) -> Any:
    """Recursively normalize data structure for consistent hashing.

    Sorts dictionary keys alphabetically and recursively processes nested
    structures to ensure consistent hash generation regardless of key ordering.

    Args:
        obj: The object to normalize (dict, list, or primitive type)

    Returns:
        Normalized version of the object with sorted keys

    Raises:
        TypeError: If the object contains non-serializable types
    """
    if obj is None or isinstance(obj, (bool, int, float, str)):
        return obj

    if isinstance(obj, list):
        return [normalize_for_hashing(item) for item in obj]

    if isinstance(obj, dict):
        sorted_dict = {}
        for key in sorted(obj.keys()):
            sorted_dict[key] = normalize_for_hashing(obj[key])
        return sorted_dict

    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


def content_hash(data: Any) -> str:
    """Generate a content-addressed hash for the given data.

    Creates a stable SHA-256 hash of data by normalizing the structure
    before hashing. This ensures the same data always produces the same hash
    regardless of key ordering or whitespace in the original representation.

    The data is normalized before hashing:
    * Dictionary keys are sorted alphabetically
    * JSON is minified (no whitespace)
    * Consistent field ordering throughout nested structures

    Args:
        data: The data to hash (dict, list, or JSON-serializable primitive)

    Returns:
        A 12-character hexadecimal hash string

    Raises:
        TypeError: If data contains non-JSON-serializable types
        ValueError: If data is empty or invalid
    """
    if data is None:
        raise ValueError("Cannot hash None value")

    normalized = normalize_for_hashing(data)
    json_str = json.dumps(normalized, separators=(",", ":"), sort_keys=True)

    if not json_str:
        raise ValueError("Normalized data resulted in empty string")

    return hashlib.sha256(json_str.encode("utf-8")).hexdigest()[:12]
