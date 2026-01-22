"""Version data model for semantic versioning.

This module provides the core Version dataclass with no external dependencies.
It handles semantic versioning with optional SNAPSHOT suffixes.
"""

import re
from dataclasses import dataclass


@dataclass
class Version:
    """Represents a semantic version.

    Attributes:
        major: Major version number
        minor: Minor version number
        patch: Patch version number
        is_snapshot: Whether this is a snapshot (pre-release) version
    """

    major: int
    minor: int
    patch: int
    is_snapshot: bool = False

    @classmethod
    def from_string(cls, version_str: str) -> "Version":
        """Parse a version string into a Version object.

        Args:
            version_str: Version string (e.g., "v0.112.0" or "v0.113.0-SNAPSHOT")

        Returns:
            Version object

        Raises:
            ValueError: If version string is invalid

        Examples:
            >>> Version.from_string("v0.112.0")
            Version(major=0, minor=112, patch=0, is_snapshot=False)
            >>> Version.from_string("v0.113.0-SNAPSHOT")
            Version(major=0, minor=113, patch=0, is_snapshot=True)
        """
        version_str = version_str.lstrip("v")

        is_snapshot = version_str.endswith("-SNAPSHOT")
        if is_snapshot:
            version_str = version_str.replace("-SNAPSHOT", "")

        match = re.match(r"^(\d+)\.(\d+)\.(\d+)$", version_str)
        if not match:
            raise ValueError(f"Invalid version string: {version_str}")

        return cls(
            major=int(match.group(1)),
            minor=int(match.group(2)),
            patch=int(match.group(3)),
            is_snapshot=is_snapshot,
        )

    def __str__(self) -> str:
        """Return string representation with v prefix and optional SNAPSHOT suffix.

        Returns:
            String representation (e.g., "v0.112.0" or "v0.113.0-SNAPSHOT")
        """
        base = f"v{self.major}.{self.minor}.{self.patch}"
        if self.is_snapshot:
            return f"{base}-SNAPSHOT"
        return base

    def __lt__(self, other: "Version") -> bool:
        """Compare versions for sorting.

        Snapshots are considered less than releases with the same version number.

        Args:
            other: Version to compare against

        Returns:
            True if this version is less than the other
        """
        if self.major != other.major:
            return self.major < other.major
        if self.minor != other.minor:
            return self.minor < other.minor
        if self.patch != other.patch:
            return self.patch < other.patch
        if self.is_snapshot != other.is_snapshot:
            return self.is_snapshot
        return False

    def __le__(self, other: "Version") -> bool:
        """Less than or equal comparison."""
        return self == other or self < other

    def __gt__(self, other: "Version") -> bool:
        """Greater than comparison."""
        return not self <= other

    def __ge__(self, other: "Version") -> bool:
        """Greater than or equal comparison."""
        return not self < other

    def __eq__(self, other: object) -> bool:
        """Check equality between versions.

        Args:
            other: Object to compare against

        Returns:
            True if versions are equal
        """
        if not isinstance(other, Version):
            return False
        return (
            self.major == other.major
            and self.minor == other.minor
            and self.patch == other.patch
            and self.is_snapshot == other.is_snapshot
        )

    def __hash__(self) -> int:
        """Return hash for use in sets and as dictionary keys.

        Returns:
            Hash value based on version components
        """
        return hash((self.major, self.minor, self.patch, self.is_snapshot))

    def next_patch(self) -> "Version":
        """Return the next patch version (increments patch number).

        Returns:
            New Version with patch incremented by 1

        Examples:
            >>> Version(0, 112, 0).next_patch()
            Version(major=0, minor=112, patch=1, is_snapshot=False)
        """
        return Version(self.major, self.minor, self.patch + 1)
