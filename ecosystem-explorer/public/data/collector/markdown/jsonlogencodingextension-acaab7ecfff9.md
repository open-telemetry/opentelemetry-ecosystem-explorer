## Configuration

| Name       | Description                                                                           | Default |
|------------|---------------------------------------------------------------------------------------|---------|
| mode       | What mode of the JSON encoding extension you want                                     | body    |
| array_mode | Set whether JSON payloads is extracted from an array(legacy mode). Accepts a boolean. | true    |

### Mode

#### body Mode

The `body` mode of the JSON encoding extension is used to marshal or unmarshal the JSON log body, ignoring other log fields.


#### body_with_inline_attributes

The `body_with_inline_attributes` mode within the JSON encoding extension grabs the resource and attributes and adds them as key value pairs to the JSON body. It iterates through all the logs and creates a JSON array like the following example:

```json
[
  {
    "body": {
      "log": "test"
    },
    "resourceAttributes": {
      "test": "logs-test"
    },
    "logAttributes": {
      "foo": "bar"
    }
  },
  {
    "body": "log testing",
    "resource": {
      "test": "logs-test"
    }
  }
]
```

### array_mode

Configuration accepts a boolean.

- `array_mode: true` : This is the default mode to preserve backward compatibility. JSON input is expected as an array
  
   > [{"key": "value"}, {"key": "value"}]

- `array_mode: false` : Disable legacy mode and allow to accept a verity of JSON payloads. This includes single document or even a concatenated JSON payload

  Single payload
  > {"key": "value"}

  New line delimited JSON payload
  > {"key": "value"}\
  > {"key": "value"}
  