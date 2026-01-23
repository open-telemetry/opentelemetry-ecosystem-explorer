"""Collector Watcher - OpenTelemetry Collector component metadata automation."""

from .component_scanner import ComponentScanner
from .metadata_parser import MetadataParser
from .repository_manager import RepositoryManager
from .type_defs import DistributionName
from .version import Version
from .version_detector import VersionDetector

__version__ = "0.1.0"

__all__ = [
    "ComponentScanner",
    "MetadataParser",
    "RepositoryManager",
    "DistributionName",
    "Version",
    "VersionDetector",
]
