# Java Instrumentation Watcher

Automation tool for synchronizing OpenTelemetry Java Agent instrumentation metadata to the ecosystem registry.

The Metadata target source is:  
<https://github.com/open-telemetry/opentelemetry-java-instrumentation/blob/main/docs/instrumentation-list.yaml>

## Methodology

On a scheduled basis, the tool fetches the OpenTelemetry Java Agent instrumentation metadata to detect any changes.

Process:

* Fetch the latest release tag from GitHub
* Download the `instrumentation-list.yaml` file for the release
* Parse and normalize the data using version-specific parsers
* Create or update versioned snapshots of instrumentation metadata in YAML format
* Update snapshot from the `main` branch

It maintains a versioned inventory of instrumentation snapshots in YAML format in the
`ecosystem-registry/java/javaagent` directory.

### Data Processing

The tool uses a version-aware parser system to handle different `file_format` versions:

* **String cleaning**: All string values are automatically stripped of leading/trailing whitespace
* **Library flattening**: Nested library structures are converted to a flat list with tags
  * Input: `libraries: { groupName: [lib1, lib2] }`
  * Output: `libraries: [lib1{tags: ["groupName"]}, lib2{tags: ["groupName"]}]`
* **Version detection**: Automatically detects `file_format` from YAML and applies the appropriate parser

### Adding New Version Parsers

To support a new `file_format` version:

1. Create a new parser class in `instrumentation_parser.py`:

   ```python
   class ParserV03(ParserV02):
       def get_file_format(self) -> float:
           return 0.3

       def parse(self, yaml_content: str) -> dict[str, Any]:
           # Implement version-specific parsing logic
           pass
   ```

2. Register the parser in `ParserFactory._parsers`:

   ```python
   _parsers: dict[float, type[InstrumentationParser]] = {
       0.1: ParserV01,
       0.2: ParserV02,
       0.3: ParserV03,  # Add new parser
   }
   ```

3. Add tests in `test_instrumentation_parser.py` to verify the new parser behavior.

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
