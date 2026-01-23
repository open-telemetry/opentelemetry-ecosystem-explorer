"""Main entry point for collector watcher."""

from collector_watcher.component_scanner import ComponentScanner
from collector_watcher.repository_manager import RepositoryManager


def print_components(components):
    for component_type, component_list in components:
        print(f"\n{component_type.upper()} ({len(component_list)}):")
        for component in component_list:
            name = component["name"]
            display_name = component.get("metadata", {}).get("display_name", None)
            if display_name:
                name += f" ({display_name})"
            print(f"  - {name}")


def main():
    """Entry point for the collector watcher application."""
    print("Collector Watcher is running...")

    # Setup repositories
    manager = RepositoryManager()
    paths = manager.setup_all_repositories()
    print("All repositories have been set up.")

    print(f"\nScanning core repository at {paths['core']}...")
    core_scanner = ComponentScanner(str(paths["core"]))
    core_components = core_scanner.scan_all_components()

    print("\nCore Components Found:")
    print_components(core_components.items())

    print(f"\nScanning contrib repository at {paths['contrib']}...")

    contrib_scanner = ComponentScanner(str(paths["contrib"]))
    contrib_components = contrib_scanner.scan_all_components()

    print("\nContrib Components Found:")
    print_components(contrib_components.items())

    core_total = sum(len(component_list) for component_list in core_components.values())
    contrib_total = sum(len(component_list) for component_list in contrib_components.values())
    print(f"\n{'=' * 60}")
    print(f"Summary: {core_total} core components, {contrib_total} contrib components")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
