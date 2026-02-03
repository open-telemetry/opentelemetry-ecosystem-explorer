"""Documentation generator for OpenTelemetry Collector components."""

from typing import Any


class DocContentGenerator:
    """Generates component tables for marker-based documentation updates."""

    # Subtypes that should be rendered as separate tables
    EXTENSION_SUBTYPES = ["encoding", "observer", "storage"]

    def __init__(self, version: str | None = None):
        """
        Initialize the documentation generator.

        Args:
            version: Version string to include in generated content (e.g., "v0.138.0")
        """
        self.version = version

    @staticmethod
    def get_stability_by_signal(metadata: dict[str, Any]) -> dict[str, str]:
        """
        Get stability information by signal type.

        Args:
            metadata: Component metadata containing status.stability

        Returns:
            Dictionary mapping signal type to stability level
            For extensions: {"extension": "beta"}
            For others: {"traces": "beta", "metrics": "alpha", "logs": "-"}
        """
        if not metadata or "status" not in metadata:
            return {}

        status = metadata.get("status", {})
        stability = status.get("stability", {})

        if not stability:
            return {}

        signal_stability = {}
        for level, signals in stability.items():
            if isinstance(signals, list):
                for signal in signals:
                    signal_stability[signal] = level

        return signal_stability

    def _get_distributions(self, component: dict[str, Any]) -> list[str]:
        """
        Get the list of distributions for a component.

        Args:
            component: Component data

        Returns:
            List of distribution names (e.g., ["core", "contrib"])
        """
        metadata = component.get("metadata", {})
        if not metadata:
            return ["contrib"]

        status = metadata.get("status", {})
        distributions = status.get("distributions", [])

        if not distributions:
            return ["contrib"]

        return sorted(distributions)

    def _format_distributions(self, distributions: list[str]) -> str:
        """
        Format distribution list for display in table.

        Args:
            distributions: List of distribution names

        Returns:
            Formatted string (e.g., "core, contrib")
        """
        if not distributions:
            return "-"

        # Capitalize distribution names to match textlint terminology rules
        # (e.g., "k8s" -> "K8s")
        capitalized = []
        for dist in distributions:
            if dist.lower() == "k8s":
                capitalized.append("K8s")
            else:
                capitalized.append(dist)

        return ", ".join(capitalized)

    def _is_unmaintained(self, component: dict[str, Any]) -> bool:
        """
        Check if a component is unmaintained.

        A component is considered unmaintained if any of its signals
        have an "unmaintained" stability level.

        Args:
            component: Component data

        Returns:
            True if component is unmaintained
        """
        metadata = component.get("metadata", {})
        if not metadata:
            return False

        status = metadata.get("status", {})
        stability = status.get("stability", {})

        # Check if "unmaintained" is one of the stability levels
        return "unmaintained" in stability

    def _filter_by_subtype(self, components: list[dict[str, Any]], subtype: str | None) -> list[dict[str, Any]]:
        """
        Filter components by subtype.

        Args:
            components: List of components
            subtype: Subtype to filter by (None means components without subtype)

        Returns:
            Filtered list of components
        """
        if subtype is None:
            # Return components without a subtype
            return [c for c in components if c.get("subtype") is None]
        else:
            return [c for c in components if c.get("subtype") == subtype]

    def _generate_component_table(
        self,
        component_type: str,
        components: list[dict[str, Any]],
        subtype: str | None = None,
        include_footnotes: bool = True,
    ) -> str:
        """
        Generate a table of components with distributions column.

        Args:
            component_type: Type of component (receiver, processor, etc.)
            components: List of components to include in table
            subtype: Optional subtype for nested components (e.g., "encoding")
            include_footnotes: Whether to include footnote definitions (default True).
                              Set to False for subtype tables to avoid duplicate footnotes.

        Returns:
            Markdown table content
        """
        table_content = ""

        if component_type == "extension":
            table_content += "| Name | Distributions[^1] | Stability[^2] |\n"
            table_content += "|------|-------------------|---------------|\n"
        elif component_type == "connector":
            # Connectors don't have stability columns due to different stability definitions
            table_content += "| Name | Distributions[^1] |\n"
            table_content += "|------|-------------------|\n"
        else:
            table_content += "| Name | Distributions[^1] | Traces[^2] | Metrics[^2] | Logs[^2] |\n"
            table_content += "|------|-------------------|------------|-------------|----------|\n"

        for component in components:
            name = component.get("name", "unknown")
            metadata = component.get("metadata", {})

            distributions = self._get_distributions(component)
            distributions_str = self._format_distributions(distributions)
            stability_map = self.get_stability_by_signal(metadata)
            source_repo = component.get("source_repo", "contrib")

            if source_repo == "core":
                repo_name = "opentelemetry-collector"
            else:
                repo_name = "opentelemetry-collector-contrib"

            repo_url = f"https://github.com/open-telemetry/{repo_name}"

            # Build component path - include subtype directory for nested components
            if subtype:
                component_path = f"{component_type}/{subtype}/{name}"
            else:
                component_path = f"{component_type}/{name}"

            readme_link = f"{repo_url}/tree/main/{component_path}"
            name_link = f"[{name}]({readme_link})"

            # Add unmaintained emoji if component has no active maintainers
            # (Skip for connectors since we don't show stability columns)
            if component_type != "connector" and self._is_unmaintained(component):
                name_link += " ⚠️"

            if component_type == "extension":
                stability = stability_map.get("extension", "N/A")
                table_content += f"| {name_link} | {distributions_str} | {stability} |\n"
            elif component_type == "connector":
                # Connectors only show name and distributions
                table_content += f"| {name_link} | {distributions_str} |\n"
            else:
                traces = stability_map.get("traces", "-")
                metrics = stability_map.get("metrics", "-")
                logs = stability_map.get("logs", "-")
                table_content += f"| {name_link} | {distributions_str} | {traces} | {metrics} | {logs} |\n"

        # Only include footnotes if requested (avoids duplicates on pages with multiple tables)
        if not include_footnotes:
            return table_content

        table_content += "\n"
        stability_link = (
            "https://github.com/open-telemetry/opentelemetry-collector/blob/main/docs/component-stability.md"
        )

        # Footnotes use multi-line indented format to match existing docs
        table_content += "[^1]:\n"
        table_content += "    Shows which [distributions](/docs/collector/distributions/) (core, contrib,\n"
        table_content += "    K8s, etc.) include this component.\n"

        # Only add stability footnote for non-connector components
        if component_type != "connector":
            table_content += "\n[^2]:\n"
            table_content += "    For details about component stability levels, see the\n"
            table_content += f"    [OpenTelemetry Collector component stability definitions]({stability_link}).\n"

        return table_content

    def generate_component_table(
        self,
        component_type: str,
        components: list[dict[str, Any]],
        subtype: str | None = None,
        include_footnotes: bool = True,
    ) -> str:
        """
        Generate table content for a component type (for marker-based updates).

        Args:
            component_type: Type of component (receiver, processor, etc.)
            components: List of components of this type
            subtype: Optional subtype to filter by (e.g., "encoding")
            include_footnotes: Whether to include footnote definitions (default True)

        Returns:
            Markdown table content (no front matter or headers)
        """
        # Filter by subtype if specified
        filtered = self._filter_by_subtype(components, subtype)
        sorted_components = sorted(filtered, key=lambda c: c.get("name", ""))
        return self._generate_component_table(
            component_type, sorted_components, subtype=subtype, include_footnotes=include_footnotes
        )

    def generate_footnotes(self, component_type: str, components: list[dict[str, Any]]) -> str:
        """
        Generate footnotes section for a component type.

        Args:
            component_type: Type of component (receiver, processor, etc.)
            components: List of components (unused, kept for API compatibility)

        Returns:
            Markdown footnotes content
        """
        stability_link = (
            "https://github.com/open-telemetry/opentelemetry-collector/blob/main/docs/component-stability.md"
        )

        # Footnotes use multi-line indented format to match existing docs
        footnotes = "[^1]:\n"
        footnotes += "    Shows which [distributions](/docs/collector/distributions/) (core, contrib,\n"
        footnotes += "    K8s, etc.) include this component.\n"

        # Only add stability footnote for non-connector components
        if component_type != "connector":
            footnotes += "\n[^2]:\n"
            footnotes += "    For details about component stability levels, see the\n"
            footnotes += f"    [OpenTelemetry Collector component stability definitions]({stability_link}).\n"

        return footnotes

    def generate_all_component_tables(self, inventory: dict[str, Any]) -> dict[str, str]:
        """
        Generate table content for all component types (for marker-based updates).

        Args:
            inventory: Complete inventory data

        Returns:
            Dictionary mapping marker_id to table content.
            For extensions with subtypes, includes separate tables like:
            - "extension" - main extensions (no subtype, no footnotes)
            - "extension-encoding" - encoding extensions (no footnotes)
            - "extension-observer" - observer extensions (no footnotes)
            - "extension-storage" - storage extensions (no footnotes)
            - "extension-footnotes" - shared footnotes for all extension tables

            Extension footnotes are generated separately so they can be placed
            at the bottom of the page.
        """
        tables = {}
        components = inventory.get("components", {})

        for component_type in ["receiver", "processor", "exporter", "connector"]:
            component_list = components.get(component_type, [])
            tables[component_type] = self.generate_component_table(component_type, component_list)

        # Handle extensions specially - separate main extensions from subtypes
        extension_list = components.get("extension", [])

        # Main extensions table (components without subtype) - NO footnotes
        tables["extension"] = self.generate_component_table(
            "extension", extension_list, subtype=None, include_footnotes=False
        )

        # Subtype tables for extensions - no footnotes
        for subtype in self.EXTENSION_SUBTYPES:
            subtype_components = self._filter_by_subtype(extension_list, subtype)
            if subtype_components:
                # Use marker_id like "extension-encoding"
                marker_id = f"extension-{subtype}"
                tables[marker_id] = self.generate_component_table(
                    "extension", extension_list, subtype=subtype, include_footnotes=False
                )

        # Generate shared footnotes for extension page (at the bottom)
        tables["extension-footnotes"] = self.generate_footnotes("extension", extension_list)

        return tables
