"""Collector Watcher - OpenTelemetry Collector component metadata automation."""

from .types import DistributionName
from .version import Version
from .version_detector import VersionDetector

__version__ = "0.1.0"

__all__ = ["DistributionName", "Version", "VersionDetector"]
