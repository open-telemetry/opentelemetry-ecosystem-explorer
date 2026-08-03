## Configuration Fields

| Field                     | Default              | Description                                                                                                        |
| ---                       | ---                  | ---                                                                                                                |
| `listen_address`          | required             | A listen address of the form `<ip>:<port>`                                                                         |
| `attributes`              | {}                   | A map of `key: value` pairs to add to the entry's attributes. Keys must be strings, values must be strings or [expressions](../../pkg/stanza/docs/types/expression.md) that evaluate to a string. |
| `one_log_per_packet`      | false                | Skip log tokenization, set to true if logs contains one log per record and multiline is not used.  This will improve performance.                                                 |
| `resource`                | {}                   | A map of `key: value` pairs to add to the entry's resource. Keys must be strings, values must be strings or [expressions](../../pkg/stanza/docs/types/expression.md) that evaluate to a string. |
| `add_attributes`          | false                | Adds `net.*` attributes according to [semantic convention](https://github.com/open-telemetry/semantic-conventions/blob/v1.42.0/docs/registry/attributes/network.md#deprecated-network-attributes) |
| `multiline`               |                      | A `multiline` configuration block. See below for details                                                           |
| `encoding`                | `utf-8`              | The encoding of the file being read. See the list of supported encodings below for available options               |
| `operators`               | []                   | An array of [operators](../../pkg/stanza/docs/operators/README.md#what-operators-are-available). See below for more details |
| `async`                   | nil                  | An `async` configuration block. See below for details. |

### Operators

Each operator performs a simple responsibility, such as parsing a timestamp or JSON. Chain together operators to process logs into a desired format.

- Every operator has a `type`.
- Every operator can be given a unique `id`. If you use the same type of operator more than once in a pipeline, you must specify an `id`. Otherwise, the `id` defaults to the value of `type`.
- Operators will output to the next operator in the pipeline. The last operator in the pipeline will emit from the receiver. Optionally, the `output` parameter can be used to specify the `id` of another operator to which logs will be passed directly.
- Only parsers and general purpose operators should be used.

### Parsers with Embedded Operations

Many parsers operators can be configured to embed certain followup operations such as timestamp and severity parsing. For more information, see [complex parsers](../../pkg/stanza/docs/types/parsers.md#complex-parsers).

### `multiline` configuration

If set, the `multiline` configuration block instructs the `udp_log` receiver to split log entries on a pattern other than newlines.

**note** If `multiline` is not set at all, it won't split log entries at all. Every UDP packet is going to be treated as log.
**note** `multiline` detection works per UDP packet due to protocol limitations.

The `multiline` configuration block must contain exactly one of `line_start_pattern` or `line_end_pattern`. These are regex patterns that
match either the beginning of a new log entry, or the end of a log entry.

The `omit_pattern` setting can be used to omit the start/end pattern from each entry.

### Supported encodings

| Key        | Description
| ---        | ---                                                              |
| `nop`      | No encoding validation. Treats the file as a stream of raw bytes |
| `utf-8`    | UTF-8 encoding                                                   |
| `utf-16le` | UTF-16 encoding with little-endian byte order                    |
| `utf-16be` | UTF-16 encoding with little-endian byte order                    |
| `ascii`    | ASCII encoding                                                   |
| `big5`     | The Big5 Chinese character encoding                              |

Other less common encodings are supported on a best-effort basis.
See [https://www.iana.org/assignments/character-sets/character-sets.xhtml](https://www.iana.org/assignments/character-sets/character-sets.xhtml)
for other encodings available.

#### `async` configuration

If set, the `async` configuration block instructs the `udp_input` operator to read and process logs asynchronously and concurrently.

**note** If `async` is not set at all, a single thread will read lines synchronously.

| Field                                   | Default              | Description |
| ---                                     | ---                  | ---         |
| `readers`                               | 1                    | Concurrency level - Determines how many go routines read from UDP port and push to channel (to be handled by processors). |
| `processors`                            | 1                    | Concurrency level - Determines how many go routines read from channel (pushed by readers) and process logs before sending downstream. |
| `max_queue_length`                      | 100                  | Determines max length of channel being used by async reader routines. When channel reaches max number, reader routine will block until channel has room. |

## Example Configurations

### Simple

Configuration:

```yaml
receivers:
  udp_log:
    listen_address: "0.0.0.0:54525"
```

The deprecated component type `udplog` is still accepted:

```yaml
receivers:
  udplog:
    listen_address: "0.0.0.0:54525"
```
