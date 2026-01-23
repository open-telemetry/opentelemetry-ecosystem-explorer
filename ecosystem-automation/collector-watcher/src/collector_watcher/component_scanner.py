"""Scanner for discovering OpenTelemetry Collector components.

This module scans collector repository directories to identify components
and extract their metadata from metadata.yaml files.
"""

from pathlib import Path
from typing import Any

from .metadata_parser import MetadataParser


class ComponentScanner:
    """Scans collector repositories for components."""

    COMPONENT_TYPES = ["connector", "exporter", "extension", "processor", "receiver"]

    # These directories are handled separately as nested component directories
    # or are utility packages that aren't actual components
    EXCLUDED_DIRECTORIES = [
        "extensionauth",  # Auth helpers for extensions
        "extensioncapabilities",  # Capabilities framework
        "extensionmiddleware",  # Middleware framework
        "opampcustommessages",  # OpAMP utilities
    ]

    # Directories that contain nested components (subtypes)
    NESTED_COMPONENT_DIRS = {"encoding", "observer", "storage"}

    def __init__(self, repo_path: str):
        """
        Args:
            repo_path: Path to the cloned repository
        """
        self.repo_path = Path(repo_path)
        if not self.repo_path.exists():
            raise ValueError(f"Repository path does not exist: {repo_path}")

    def scan_all_components(self) -> dict[str, list[dict[str, Any]]]:
        """
        Scan all component types and return structured inventory.

        Returns:
            Dictionary mapping component types to lists of component info
        """
        components = {}
        for component_type in self.COMPONENT_TYPES:
            components[component_type] = self.scan_component_type(component_type)
        return components

    def scan_component_type(self, component_type: str) -> list[dict[str, Any]]:
        """
        Scan a specific component type directory.

        Args:
            component_type: Type of component (receiver, processor, exporter etc.)

        Returns:
            List of dictionaries containing component information
        """
        component_dir = self.repo_path / component_type
        if not component_dir.exists():
            return []

        components = []
        for item in sorted(component_dir.iterdir()):
            if item.is_dir():
                # Check if this is a nested component directory (e.g., extension/encoding)
                if item.name in self.NESTED_COMPONENT_DIRS:
                    nested_components = self._scan_nested_components(item, component_type, item.name)
                    components.extend(nested_components)
                elif self._is_component_directory(item):
                    component_info = self._extract_component_info(item, component_type)
                    components.append(component_info)

        return components

    def _scan_nested_components(self, nested_dir: Path, component_type: str, subtype: str) -> list[dict[str, Any]]:
        """
        Scan a nested component directory (e.g., extension/encoding).

        Args:
            nested_dir: Path to the nested directory
            component_type: Type of component (e.g., extension)
            subtype: Subtype name (e.g., encoding, observer, storage)

        Returns:
            List of component dictionaries with subtype field set
        """
        components = []
        for item in sorted(nested_dir.iterdir()):
            if item.is_dir() and self._is_nested_component_directory(item):
                component_info = self._extract_component_info(item, component_type, subtype=subtype)
                components.append(component_info)
        return components

    def _is_valid_component_name(self, path: Path) -> bool:
        """
        Check if a directory name is valid for a component.

        Excludes hidden, private, internal, test, and utility directories.

        Args:
            path: Path to check

        Returns:
            True if the directory name is valid
        """
        if path.name.startswith(".") or path.name.startswith("_"):
            return False
        if path.name in ["internal", "testdata"]:
            return False
        if path.name.endswith("test") or path.name.endswith("helper"):
            return False
        return True

    def _has_go_code(self, path: Path) -> bool:
        """
        Check if a directory contains Go code.

        Args:
            path: Path to check

        Returns:
            True if directory has go.mod or .go files
        """
        has_go_mod = (path / "go.mod").exists()
        # Use next() to short-circuit and avoid scanning entire directory
        has_go_files = next(path.glob("*.go"), None) is not None
        return has_go_mod or has_go_files

    def _is_nested_component_directory(self, path: Path) -> bool:
        """
        Check if a directory is a valid nested component.

        Similar to _is_component_directory but for nested components.

        Args:
            path: Path to check

        Returns:
            True if this appears to be a nested component directory
        """
        return self._is_valid_component_name(path) and self._has_go_code(path)

    def _is_component_directory(self, path: Path) -> bool:
        """
        Check if a directory is a valid component.

        A valid component directory typically contains go.mod or .go files,
        and excludes internal/test/utility directories.

        Args:
            path: Path to check

        Returns:
            True if this appears to be a component directory
        """
        if not self._is_valid_component_name(path):
            return False

        if path.name in self.EXCLUDED_DIRECTORIES:
            return False

        # Nested component directories are handled separately
        if path.name in self.NESTED_COMPONENT_DIRS:
            return False

        return self._has_go_code(path)

    def _extract_component_info(
        self, component_path: Path, component_type: str, subtype: str | None = None
    ) -> dict[str, Any]:
        """
        Extract information about a component.

        Args:
            component_path: Path to the component directory
            component_type: Type of component
            subtype: Optional subtype (e.g., "encoding", "observer", "storage")

        Returns:
            Dictionary with component information
        """
        parser = MetadataParser(component_path)
        has_metadata = parser.has_metadata()

        component_info = {
            "name": component_path.name,
        }

        # Add subtype if this is a nested component
        if subtype:
            component_info["subtype"] = subtype

        if has_metadata:
            parsed_metadata = parser.parse()
            if parsed_metadata:
                component_info["metadata"] = parsed_metadata
            else:
                component_info["has_metadata"] = False
        else:
            component_info["has_metadata"] = False

        return component_info
