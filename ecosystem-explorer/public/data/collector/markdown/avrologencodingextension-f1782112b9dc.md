The extension accepts a configuration option to specify the Avro schema to use to read the log record body.

Example:
```yaml
extensions:
  avro_log_encoding:
    schema: |
      {
        "type" : "record",
        "namespace" : "example",
        "name" : "Datapoint",
        "fields" : [
          { "name" : "Key" , "type" : "string" },
          { "name" : "Value" , "type" : "int" }
        ]
      }
```