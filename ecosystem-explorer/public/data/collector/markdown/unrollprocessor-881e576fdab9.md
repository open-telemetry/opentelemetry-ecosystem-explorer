## Supported pipelines

- Logs


## How it works

The Unroll Processor processes log records through the following steps:

1. The processor examines each incoming log record to determine if the body contains a slice (array) structure
2. For log records with slice bodies, each element of the slice is extracted and used to create a new individual log record
3. Each new log record retains all the original metadata (timestamps, attributes, etc.) from the parent record
4. When `recursive` is enabled, the processor will also unroll nested slices within slice elements

## Config

### General Config

```yaml
unroll:
  recursive: false   # Whether to recursively unroll nested slices
```

| Field     | Type   | Default | Description                                                                                                |
| --------- | ------ | ------- | ---------------------------------------------------------------------------------------------------------- |
| recursive | bool   | false   | Whether to recursively unroll nested slices within slice elements                                         |

### Example configuration

```yaml
unroll:
  recursive: false
```



## Examples

### Basic Usage

The simplest configuration for the unroll processor:

```yaml
processors:
  unroll:
    recursive: false

service:
  pipelines:
    logs:
      receivers: [otlp]
      processors: [unroll]
      exporters: [debug]
```

### Split a log record into multiple via a delimiter

The following configuration utilizes the [transform processor](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/transformprocessor) to first split the original string body using a delimiter, and then the unroll processor creates multiple log records from the resulting slice.

```yaml
receivers:
  file_log:
    include: [ ./test.txt ]
    start_at: beginning

processors:
  transform:
    log_statements:
      - context: log
        statements:
          - set(body, Split(body, ","))
  unroll:
    recursive: false

exporters:
  file:
    path: ./test/output.json

service:
  pipelines:
    logs:
      receivers: [file_log]
      processors: [transform, unroll]
      exporters: [file]
```

#### Input and Output Example

<details>
<summary>Sample Input Data</summary>

**Input file (test.txt):**
```txt
1,2,3
```

**After transform processor (before unroll):**
The body becomes a slice: `["1", "2", "3"]`

</details>

<details>
<summary>Final Output (after unroll)</summary>

```json
{
  "resourceLogs": [
    {
      "resource": {},
      "scopeLogs": [
        {
          "scope": {},
          "logRecords": [
            {
              "observedTimeUnixNano": "1733240156591852000",
              "body": { "stringValue": "1" },
              "attributes": [
                {
                  "key": "log.file.name",
                  "value": { "stringValue": "test.txt" }
                }
              ],
              "traceId": "",
              "spanId": ""
            },
            {
              "observedTimeUnixNano": "1733240156591852000",
              "body": { "stringValue": "2" },
              "attributes": [
                {
                  "key": "log.file.name",
                  "value": { "stringValue": "test.txt" }
                }
              ],
              "traceId": "",
              "spanId": ""
            },
            {
              "observedTimeUnixNano": "1733240156591852000",
              "body": { "stringValue": "3" },
              "attributes": [
                {
                  "key": "log.file.name",
                  "value": { "stringValue": "test.txt" }
                }
              ],
              "traceId": "",
              "spanId": ""
            }
          ]
        }
      ]
    }
  ]
}
```
</details>

### Recursive Unrolling

When dealing with nested slices, you can enable recursive unrolling:

```yaml
processors:
  unroll:
    recursive: true

service:
  pipelines:
    logs:
      receivers: [otlp]
      processors: [unroll]
      exporters: [debug]
```

This configuration will unroll nested slices within slice elements, creating individual log records for all nested elements.

### Common Issues

#### Log records not being unrolled
- **Cause**: The log body is not a slice/array type
- **Solution**: Ensure the log body contains a slice. You may need to use the [transform processor](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/transformprocessor) to convert string data to slices first

#### Unexpected number of output records
- **Cause**: Nested slices with `recursive: false` setting
- **Solution**: Enable `recursive: true` if you want to unroll nested slices, or restructure your data to avoid nested arrays

#### Performance issues with large slices
- **Cause**: Very large slices being unrolled into many individual log records
- **Solution**: Consider preprocessing the data to limit slice sizes or batch processing

## Warnings

The Unroll Processor modifies the structure and quantity of log records in your telemetry pipeline. Consider the following warnings:

- **Data Volume**: Unrolling slices can significantly increase the number of log records, which may impact downstream processing performance and storage requirements.
- **Resource Usage**: Large slices will consume more memory and CPU resources during the unrolling process.
- **Downstream Compatibility**: Ensure that downstream processors and exporters can handle the increased volume of log records.
- **Metadata Duplication**: Each unrolled log record retains the same metadata (timestamps, attributes, etc.) from the original record, which may result in data duplication.

Use this processor carefully in production environments and monitor resource usage and performance impact.
