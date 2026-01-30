"""Collector Watcher - OpenTelemetry Collector component metadata automation."""

import importlib.metadata

from .collector_sync import CollectorSync
from .component_scanner import ComponentScanner
from .inventory_manager import InventoryManager
from .metadata_parser import MetadataParser
from .repository_manager import RepositoryManager
from .type_defs import DistributionName
from .version import Version
from .version_detector import VersionDetector

__version__ = importlib.metadata.version("collector-watcher")

__all__ = [
    "CollectorSync",
    "ComponentScanner",
    "InventoryManager",
    "MetadataParser",
    "RepositoryManager",
    "DistributionName",
    "Version",
    "VersionDetector",
]
