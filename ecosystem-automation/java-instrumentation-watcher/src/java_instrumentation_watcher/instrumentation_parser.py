# Copyright The OpenTelemetry Authors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
"""Parser system for Java instrumentation metadata with version support."""

from abc import ABC, abstractmethod
from typing import Any

import yaml


class InstrumentationParser(ABC):
    """Base class for version-specific instrumentation parsers."""

    @abstractmethod
    def parse(self, yaml_content: str) -> dict[str, Any]:
        """
        Parse and normalize instrumentation YAML content.

        Args:
            yaml_content: Raw YAML string

        Returns:
            Normalized data dictionary
        """
        pass

    @abstractmethod
    def get_file_format(self) -> float:
        """
        Get the file format version this parser handles.

        Returns:
            File format version number
        """
        pass

    def _clean_strings(self, data: Any) -> Any:
        """
        Recursively strip trailing/leading whitespace from all string values.

        Args:
            data: Data structure to clean (dict, list, str, or primitive)

        Returns:
            Cleaned data structure
        """
        if isinstance(data, str):
            return data.strip()
        elif isinstance(data, dict):
            return {k: self._clean_strings(v) for k, v in data.items()}
        elif isinstance(data, list):
            return [self._clean_strings(item) for item in data]
        return data


class ParserV01(InstrumentationParser):
    """Parser for file_format 0.1."""

    def get_file_format(self) -> float:
        return 0.1

    def parse(self, yaml_content: str) -> dict[str, Any]:
        """
        Parse and normalize file_format 0.1 YAML content.

        Args:
            yaml_content: Raw YAML string

        Returns:
            Normalized data dictionary with cleaned strings and flattened libraries
        """
        try:
            data = yaml.safe_load(yaml_content) or {}
            cleaned_data = self._clean_strings(data)
            return self._flatten_libraries(cleaned_data)
        except yaml.YAMLError as e:
            raise ValueError(f"Error parsing instrumentation YAML: {e}") from e

    @staticmethod
    def _flatten_libraries(data: dict[str, Any]) -> dict[str, Any]:
        """
        Flatten library structure from {group: [libs]} to [libs with tags].

        Args:
            data: Data dictionary with nested libraries structure

        Returns:
            Data dictionary with flattened libraries list
        """
        if "libraries" not in data or not isinstance(data["libraries"], dict):
            return data

        flattened_libraries = []
        for group_name, libraries in data["libraries"].items():
            if not isinstance(libraries, list):
                continue
            for library in libraries:
                if isinstance(library, dict):
                    library["tags"] = [group_name]
                flattened_libraries.append(library)

        data["libraries"] = flattened_libraries
        return data


class ParserV02(ParserV01):
    """Parser for file_format 0.2."""

    def get_file_format(self) -> float:
        return 0.2

    def parse(self, yaml_content: str) -> dict[str, Any]:
        """
        Parse and normalize file_format 0.2 YAML content.

        In 0.2 format:
        - target_versions.javaagent becomes javaagent_target_versions
        - target_versions.library becomes library_target_versions

        Args:
            yaml_content: Raw YAML string

        Returns:
            Normalized data dictionary with cleaned strings and flattened libraries
        """
        try:
            data = yaml.safe_load(yaml_content) or {}
            cleaned_data = self._clean_strings(data)
            flattened_data = self._flatten_libraries(cleaned_data)
            return flattened_data
        except yaml.YAMLError as e:
            raise ValueError(f"Error parsing instrumentation YAML: {e}") from e


class ParserV03(ParserV02):
    """Parser for file_format 0.3."""

    def parse(self, data):
        raise Exception("Simulated failure for testing")

    # def get_file_format(self) -> float:
    #     return 0.3

    # def parse(self, yaml_content: str) -> dict[str, Any]:
    #     """
    #     Parse and normalize file_format 0.3 YAML content.

    #     Changes from 0.2:
    #     - 'type' field renamed to 'data_type'
    #     """
    #     try:
    #         data = yaml.safe_load(yaml_content) or {}
    #         cleaned_data = self._clean_strings(data)
    #         flattened_data = self._flatten_libraries(cleaned_data)
    #         return self._normalize_metrics(flattened_data)
    #     except yaml.YAMLError as e:
    #         raise ValueError(f"Error parsing instrumentation YAML: {e}") from e

    # @staticmethod
    # def _normalize_metrics(data: dict[str, Any]) -> dict[str, Any]:
    #     """
    #     Normalize metrics: handle 'data_type' and 'instrument' fields.
    #     """
    #     if "libraries" not in data:
    #         return data
    #     for library in data["libraries"]:
    #         if not isinstance(library, dict):
    #             continue
    #         for metric in library.get("metrics", []):
    #             if not isinstance(metric, dict):
    #                 continue
    #             if "type" in metric and "data_type" not in metric:
    #                 metric["data_type"] = metric.pop("type")
    #     return data


class ParserFactory:
    """Factory for creating version-specific parsers."""

    _parsers: dict[float, type[InstrumentationParser]] = {
        0.1: ParserV01,
        0.2: ParserV02,
        # 0.3: ParserV03,
    }

    @classmethod
    def get_parser(cls, file_format: float) -> InstrumentationParser:
        """
        Get parser for specified file format version.

        Args:
            file_format: File format version number

        Returns:
            Parser instance for the specified version

        Raises:
            ValueError: If file format version is not supported
        """
        parser_class = cls._parsers.get(file_format)
        if parser_class is None:
            supported = ", ".join(str(v) for v in sorted(cls._parsers.keys()))
            raise ValueError(f"Unsupported file_format: {file_format}. Supported versions: {supported}")
        return parser_class()

    @classmethod
    def get_default_parser(cls) -> InstrumentationParser:
        """
        Get the default parser (latest version).

        Returns:
            Parser instance for the latest file format version
        """
        latest_version = max(cls._parsers.keys())
        return cls.get_parser(latest_version)


def parse_instrumentation_yaml(yaml_content: str, file_format: float | None = None) -> dict[str, Any]:
    """
    Parse instrumentation YAML content using version-specific parser.

    If file_format is not specified, attempts to detect it from the YAML content.
    If detection fails, uses the default (latest) parser.

    Args:
        yaml_content: Raw YAML string
        file_format: Optional file format version. If None, will auto-detect.

    Returns:
        Normalized data dictionary

    Raises:
        ValueError: If parsing fails or unsupported file format
    """
    if file_format is None:
        try:
            data = yaml.safe_load(yaml_content)
            file_format = data.get("file_format") if data else None
        except yaml.YAMLError:
            # If auto-detection fails due to invalid YAML, fall back to the default parser below.
            file_format = None

    if file_format is not None:
        parser = ParserFactory.get_parser(file_format)
    else:
        parser = ParserFactory.get_default_parser()

    return parser.parse(yaml_content)
