"""Shared type definitions for collector-watcher.

This module contains common type aliases used across the codebase.
"""

from typing import Literal

# Distribution types for OpenTelemetry Collector repositories
DistributionName = Literal["core", "contrib"]

ComponentType = ["connector", "exporter", "extension", "processor", "receiver"]
