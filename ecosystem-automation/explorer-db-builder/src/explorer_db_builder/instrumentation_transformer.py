"""Transforms instrumentation data from different file format versions to a common schema."""

import logging
from typing import Any

logger = logging.getLogger(__name__)


def transform_instrumentation_format(inventory_data: dict[str, Any]) -> dict[str, Any]:
    """Transform instrumentation inventory data to the latest format.

    Handles transformation from different file_format versions to the current schema.

    Args:
        inventory_data: Raw inventory data from registry

    Returns:
        Transformed inventory data with libraries in the latest format

    Raises:
        ValueError: If file_format is missing or unsupported
        KeyError: If required fields are missing in the inventory data
    """
    if "file_format" not in inventory_data:
        raise ValueError("Inventory data missing 'file_format' field")

    file_format = inventory_data["file_format"]

    if file_format == 0.2:
        logger.debug("File format 0.2 detected, no transformation needed")
        return inventory_data
    elif file_format == 0.1:
        logger.debug("File format 0.1 detected, transforming to 0.2")
        return _transform_0_1_to_0_2(inventory_data)
    else:
        raise ValueError(f"Unsupported file format: {file_format}")


def _transform_0_1_to_0_2(inventory_data: dict[str, Any]) -> dict[str, Any]:
    """Transform file_format 0.1 to 0.2.

    Changes:
    - target_versions.javaagent -> javaagent_target_versions
    - target_versions.library presence -> has_standalone_library boolean
    - Removes target_versions field entirely

    Args:
        inventory_data: Inventory data in format 0.1

    Returns:
        Transformed inventory data in format 0.2
    """
    if "libraries" not in inventory_data:
        raise KeyError("Inventory data missing 'libraries' key")

    transformed_libraries = []

    for library in inventory_data["libraries"]:
        transformed_lib = library.copy()

        if "target_versions" in transformed_lib:
            target_versions = transformed_lib["target_versions"]

            if "javaagent" in target_versions:
                transformed_lib["javaagent_target_versions"] = target_versions["javaagent"]

            if "library" in target_versions and target_versions["library"]:
                transformed_lib["has_standalone_library"] = True
            else:
                transformed_lib["has_standalone_library"] = False

            del transformed_lib["target_versions"]

        transformed_libraries.append(transformed_lib)

    transformed_data = inventory_data.copy()
    transformed_data["libraries"] = transformed_libraries
    transformed_data["file_format"] = 0.2

    logger.info(f"Transformed {len(transformed_libraries)} libraries from format 0.1 to 0.2")

    return transformed_data
