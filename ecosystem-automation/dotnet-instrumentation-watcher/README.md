# .NET Instrumentation Watcher

Automation tool for synchronizing OpenTelemetry .NET instrumentation metadata to the ecosystem
registry.

The metadata source is the NuGet package registry, queried for packages owned by the `OpenTelemetry`
organization:  
<https://www.nuget.org/profiles/OpenTelemetry>

## Methodology

On a scheduled basis, the tool queries the NuGet API to detect changes in the set of published
OpenTelemetry .NET packages.

Process:

- Resolve the NuGet search endpoint from the service index
- Fetch the latest stable version of the core `OpenTelemetry` package — this is used as the
  ecosystem version
- Query all packages owned by the `OpenTelemetry` organization
- Filter and classify packages by type (instrumentation, exporter, extension)
- Create or update versioned snapshots of package metadata in YAML format
- Update the SNAPSHOT version with the current state of NuGet

It maintains a versioned inventory of snapshots in YAML format in the `ecosystem-registry/dotnet`
directory.

### Data Processing

Packages are classified by name pattern:

| Pattern in package ID                   | Assigned type     |
| --------------------------------------- | ----------------- |
| `Instrumentation`                       | `instrumentation` |
| `Exporter`                              | `exporter`        |
| `Extensions`, `Resources`, or `Sampler` | `extension`       |
| Anything else (core, unclassified)      | Skipped           |

Packages flagged as deprecated by NuGet are also skipped.

The version used for each registry snapshot is the latest stable version of the core `OpenTelemetry`
package — not the individual package version — so all modules in a snapshot share the same ecosystem
version. Individual module versions are recorded in the `version` field of each entry.

Results are sorted by package name for deterministic registry output.

## Usage

From the repository root:

```bash
uv run dotnet-instrumentation-watcher
```

Or with a custom inventory directory:

```bash
uv run dotnet-instrumentation-watcher --inventory-dir /path/to/inventory
```

## Development

From the repository root:

```bash
# Install dependencies
uv sync

# Run tests
uv run pytest ecosystem-automation/dotnet-instrumentation-watcher/tests

# Run tests with coverage
uv run pytest ecosystem-automation/dotnet-instrumentation-watcher/tests --cov=dotnet_instrumentation_watcher

# Run the module
uv run python -m dotnet_instrumentation_watcher
```

## Adding Dependencies

```bash
uv add --package dotnet-instrumentation-watcher <package-name>
```
