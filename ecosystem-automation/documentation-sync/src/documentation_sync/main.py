"""Main entry point for documentation sync automation."""

import argparse
import logging
import sys
from pathlib import Path

from collector_watcher.inventory_manager import InventoryManager

from documentation_sync.doc_content_generator import DocContentGenerator
from documentation_sync.doc_marker_updater import DocMarkerUpdater
from documentation_sync.docs_repository_manager import DocsRepositoryManager
from documentation_sync.metadata_diagnostics import MetadataDiagnostics
from documentation_sync.update_docs import get_latest_version, merge_inventories

logger = logging.getLogger(__name__)


def configure_logging():
    logging.basicConfig(
        level=logging.INFO,
        format="%(message)s",
        handlers=[logging.StreamHandler(sys.stdout)],
    )


def get_page_info(table_key: str) -> tuple[str, str]:
    """
    Determine page name and marker ID from table key.

    Extension subtypes (e.g., "extension-encoding") go in extension.md,
    everything else uses the table_key as the filename.

    Args:
        table_key: Key from tables dict (e.g., "receiver", "extension-encoding")

    Returns:
        Tuple of (page_name, marker_id)
    """
    page_name = "extension" if table_key.startswith("extension-") else table_key
    marker_id = f"{table_key}-table"
    return page_name, marker_id


def update_component_page(page_path: Path, marker_id: str, content: str, updater: DocMarkerUpdater) -> tuple[bool, str]:
    """
    Update a single component documentation page.

    Args:
        page_path: Path to the markdown file
        marker_id: Marker identifier for the section
        content: New content to insert
        updater: DocMarkerUpdater instance

    Returns:
        Tuple of (success, status_message)
    """
    if not page_path.exists():
        return False, "not found"

    success = updater.update_file(page_path, marker_id, content)
    return success, "updated" if success else f"marker '{marker_id}' not found"


def main():
    """Update docs in local opentelemetry.io repository."""
    configure_logging()

    parser = argparse.ArgumentParser(
        description="Update OpenTelemetry documentation with latest collector component data",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--no-update",
        action="store_true",
        help="Skip updating the docs repository (use existing clone)",
    )
    args = parser.parse_args()

    logger.info("=" * 60)
    logger.info("Documentation Sync")
    logger.info("=" * 60)
    logger.info("")

    logger.info("Setting up opentelemetry.io repository...")
    docs_repo_manager = DocsRepositoryManager()
    try:
        docs_repo = docs_repo_manager.setup_repository(update=not args.no_update)
    except RuntimeError as e:
        logger.error(f"❌ {e}")
        sys.exit(1)

    inventory_manager = InventoryManager("ecosystem-registry/collector")

    contrib_version = get_latest_version(inventory_manager, "contrib")
    core_version = get_latest_version(inventory_manager, "core")

    core_inventory = inventory_manager.load_versioned_inventory("core", core_version)
    contrib_inventory = inventory_manager.load_versioned_inventory("contrib", contrib_version)

    merged_inventory = merge_inventories(core_inventory, contrib_inventory)

    total_components = sum(len(comps) for comps in merged_inventory["components"].values())
    logger.info(f"Loaded {total_components} total components")

    diagnostics = MetadataDiagnostics()
    generator = DocContentGenerator(diagnostics)
    tables = generator.generate_all_component_tables(merged_inventory)

    logger.info(f"Generated {len(tables)} component tables")

    updater = DocMarkerUpdater()
    components_dir = docs_repo / "content/en/docs/collector/components"

    if not components_dir.exists():
        logger.error(f"\n❌ {components_dir} does not exist")
        logger.error("Please ensure the opentelemetry.io repository has the collector components directory")
        sys.exit(1)

    logger.info(f"\nUpdating pages in {components_dir}...")
    updated_count = 0

    for table_key, table_content in tables.items():
        page_name, marker_id = get_page_info(table_key)
        page_path = components_dir / f"{page_name}.md"

        success, status = update_component_page(page_path, marker_id, table_content, updater)

        if status == "not found":
            logger.info(f"  ⚠️  {page_name}.md not found, skipping")
        elif success:
            logger.info(f"  ✓ {page_name}.md ({marker_id})")
            updated_count += 1
        else:
            logger.info(f"  ⚠️  {page_name}.md - {status}")

    if updated_count > 0:
        logger.info(f"\n✅ Done! Updated {updated_count} page(s)")
    else:
        logger.error("\n⚠️  No pages were updated. Make sure the pages have the correct markers:")
        logger.error(
            "  <!-- BEGIN GENERATED: {component-type}-table SOURCE: open-telemetry/opentelemetry-ecosystem-explorer -->"
        )
        logger.error(
            "  <!-- END GENERATED: {component-type}-table SOURCE: open-telemetry/opentelemetry-ecosystem-explorer -->"
        )

    logger.info("\n" + "=" * 60)
    logger.info("Metadata Quality Report")
    logger.info("=" * 60 + "\n")

    if diagnostics.has_issues():
        logger.warning(diagnostics.generate_summary())

        # Save GitHub issue body to file for automatic issue creation
        issue_body = diagnostics.generate_github_issue_body()
        issue_file = Path("metadata-issues.md")
        issue_file.write_text(issue_body)
        logger.info(f"\n Detailed report saved to: {issue_file.absolute()}")
    else:
        logger.info("✅ No metadata issues found - all components have complete metadata")


if __name__ == "__main__":
    main()
