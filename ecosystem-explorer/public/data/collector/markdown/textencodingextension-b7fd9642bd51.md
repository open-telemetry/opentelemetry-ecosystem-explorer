The extension accepts an encoding and separator to unmarshal data as the body of one or more log records.
The separator accepts regular expressions.

When marshaling logs, the extension will return the body content, separated by a separator.

Here is the default configuration:
```yaml
extensions:
  text_encoding:
    encoding: utf8
    marshaling_separator: "\n"
    unmarshaling_separator: "\r?\n"
```