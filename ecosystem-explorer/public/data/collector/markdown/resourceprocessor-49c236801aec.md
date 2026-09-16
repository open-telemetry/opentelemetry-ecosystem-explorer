The resource processor can be used to apply changes on resource attributes.
Please refer to [config.go](./config.go) for the config spec.

`attributes` represents actions that can be applied on resource attributes.
See [Attributes Processor](../attributesprocessor/README.md) for more details on supported attributes actions.

## Supported Actions

- `INSERT`: Inserts the key/value to attributes when the key does not exist
- `UPDATE`: Updates an existing key with a value
- `UPSERT`: Performs insert or update depending on whether the key exists
- `DELETE`: Deletes the attribute
- `HASH`: Computes the SHA-256 hash of an existing value
- `EXTRACT`: Extracts values using a regular expression

## Default Values

The `default_value` field can be used to specify a fallback value when the primary value source (e.g., attribute, or context value) is not available. This is useful for:

- Providing sensible defaults when attributes don't exist
- Ensuring the pipeline doesn't fail due to missing configuration

Examples:

```yaml
processors:
  resource:
    attributes:
    # Basic example: set a fixed value
    - key: cloud.availability_zone
      value: "zone-1"
      action: upsert
    
    # Copy from another attribute
    - key: k8s.cluster.name
      from_attribute: k8s-cluster
      action: insert
    
    # Delete an attribute
    - key: redundant-attribute
      action: delete
    
    # Use default_value when source attribute doesn't exist
    - key: region
      from_attribute: cloud.region
      default_value: "us-east-1"
      action: insert
    
    # Use default_value when context value is not available
    - key: tenant_id
      from_context: "metadata.tenant"
      default_value: "default-tenant"
      action: upsert
```

Refer to [config.yaml](./testdata/config.yaml) for detailed
examples on using the processor.
