# Java Instrumentation Watcher

Automation tool for synchronizing OpenTelemetry Java Agent instrumentation metadata to the ecosystem registry.

The Metadata target source is:  
<https://github.com/open-telemetry/opentelemetry-java-instrumentation/blob/main/docs/instrumentation-list.yaml>

## Methodology

On a scheduled basis, the tool fetches the OpenTelemetry Java Agent instrumentation metadata to detect any changes.

Process:

* Fetch the latest release tag from GitHub
* Download the `instrumentation-list.yaml` file for the release
* Create or update versioned snapshots of instrumentation metadata in YAML format
* Update snapshot from the `main` branch

It maintains a versioned inventory of instrumentation snapshots in YAML format in the
`ecosystem-registry/java/javaagent` directory.

## Usage

From the repository root:

```bash
uv run java-instrumentation-watcher
```

Or with custom inventory directory:

```bash
uv run java-instrumentation-watcher --inventory-dir /path/to/inventory
```

## Development

From the repository root:

```bash
# Install dependencies
uv sync

# Run tests
uv run pytest ecosystem-automation/java-instrumentation-watcher/tests

# Run tests with coverage
uv run pytest ecosystem-automation/java-instrumentation-watcher/tests --cov=java_instrumentation_watcher

# Run the module
uv run python -m java_instrumentation_watcher
```

## Adding Dependencies

```bash
uv add --package java-instrumentation-watcher <package-name>
```
