"""Documentation Sync - Automatically update documentation using the registry."""

import importlib.metadata

from .doc_marker_updater import DocMarkerUpdater

__version__ = importlib.metadata.version("documentation-sync")

__all__ = ["DocMarkerUpdater"]
