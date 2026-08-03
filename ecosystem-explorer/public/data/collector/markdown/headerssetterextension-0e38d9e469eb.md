The `headers_setter` extension implements `ClientAuthenticator` and is used to
set requests headers in `gRPC` / `HTTP` exporters with values provided via
extension configurations or requests metadata (context).

Use cases include but are not limited to enabling multi-tenancy for observability
backends such as [Tempo], [Mimir], [Loki] and others by setting the `X-Scope-OrgID`
header to the value extracted from the context.

## Configuration

The following settings are available:

- `additional_auth` (Optional): The ID of another auth extension to chain with.
  When specified, this extension will call the additional auth extension first,
  then apply its own headers on top. This allows combining multiple authentication
  methods, such as OAuth2 for authorization and custom headers for additional metadata.

- `headers`: a list of header configuration objects that specify headers and
  their value sources. Each configuration object has the following properties:
    - `key`: The header name.
    - `action` (default: `upsert`): An action to perform on the header. Supported actions are:
        - `insert`: Inserts the new header if it does not exist.
        - `update`: Updates the header value if it exists.
        - `upsert`: Inserts a header if it does not exist and updates the header
          if it exists.
        - `delete`: Deletes the header.
    - `value`: The header value is looked up from the `value` property of the
      extension configuration.
    - `value_file`: The header value is read from a file. The file is watched for
      changes and the header value is automatically updated when the file changes.
      This is useful for credentials that are rotated, such as Kubernetes secrets.
    - `default_value`: (Optional) Value used if no entry for header key specified in `from_context` is present in request metadata.
    - `from_context`: The header value is looked up from the request metadata,
      such as HTTP headers, using the property value as the key (likely a header
      name).
    - `from_attribute`: The header value is taken from the request's authentication data,
      may include attributes like `subject` and `membership`.

The `value`, `value_file`, `from_context,default_value` and `from_attribute,default_value` properties are mutually exclusive.

In order for `from_context` to work, other components in the pipeline also need to be configured appropriately:
* If a [batch processor][batch-processor] is present in the pipeline, it must be configured to [preserve client metadata][batch-processor-preserve-metadata]. 
  Add the value which `from_context` needs to the `metadata_keys` of the batch processor.
* Receivers must be configured with `include_metadata: true` so that metadata keys are available to the pipeline.

#### Configuration Example

```yaml
extensions:
  headers_setter:
    headers:
      - action: insert
        key: X-Scope-OrgID
        from_context: tenant_id
        default_value: Org-ID
      - action: upsert
        key: User-ID
        value: user_id
      - action: update
        key: User-ID
        value: user_id
      - action: delete
        key: Some-Header

receivers:
  otlp:
    protocols:
      http:
        include_metadata: true

processors:
  batch:
    # Preserve the tenant-id metadata.
    metadata_keys:
    - tenant_id

exporters:
  loki:
    labels:
      resource:
        container_id: ""
        container_name: ""
    endpoint: https://localhost:<port>/loki/api/v1/push
    auth:
      authenticator: headers_setter

service:
  extensions: [ headers_setter ]
  pipelines:
    traces:
      receivers: [ otlp ]
      processors: [ batch ]
      exporters: [ loki ]
```

#### File-Based Credentials Example

The `value_file` option allows reading header values from files, which is useful
for credentials that are rotated, such as Kubernetes secrets or other dynamic
credentials:

```yaml
extensions:
  headers_setter:
    headers:
      - key: X-API-Key
        value_file: /var/secrets/api-key
        action: upsert
      - key: X-Tenant-ID
        value_file: /etc/tenant/id
        action: insert

exporters:
  otlphttp:
    endpoint: https://api.example.com/v1/traces
    auth:
      authenticator: headers_setter

service:
  extensions: [headers_setter]
  pipelines:
    traces:
      receivers: [otlp]
      exporters: [otlphttp]
```

The files are watched for changes, and header values are automatically updated
when the files are modified. This is particularly useful in Kubernetes environments
where secrets are mounted as files and can be rotated without restarting the collector.

## Chaining with other Auth Extensions

The `headers_setter` extension can be chained with another authentication extension
using the `additional_auth` parameter. This allows combining multiple authentication
methods, such as OAuth2 for bearer token authentication and custom headers for
additional metadata or routing information.

### Example: Combining OAuth2 and Custom Headers

```yaml
extensions:
  oauth2client:
    client_id: someclientid
    client_secret: someclientsecret
    token_url: https://example.com/oauth2/default/v1/token
    scopes: ["api.metrics"]
    # The timeout parameter is optional
    timeout: 2s

  headers_setter:
    # Chain with the oauth2client extension
    additional_auth: oauth2client
    headers:
      - key: X-Scope-OrgID
        value: acme-tenant
      - key: X-Custom-Header
        from_context: custom_metadata

receivers:
  otlp:
    protocols:
      http:
        include_metadata: true

exporters:
  prometheus_remote_write:
    endpoint: https://prometheus.example.com/api/v1/write
    auth:
      # Use headers_setter as the authenticator
      # This will apply both OAuth2 and custom headers
      authenticator: headers_setter

service:
  extensions: [oauth2client, headers_setter]
  pipelines:
    metrics:
      receivers: [otlp]
      exporters: [prometheus_remote_write]
```

In this configuration:
1. The `oauth2client` extension provides OAuth2 bearer token authentication
2. The `headers_setter` extension adds custom headers on top of the OAuth2 authentication
3. When the exporter sends data, both authentication methods are applied:
   - OAuth2 adds the `Authorization: Bearer <token>` header
   - Headers setter adds `X-Scope-OrgID` and `X-Custom-Header` headers
4. The collector ensures the `oauth2client` extension starts before `headers_setter`
   due to the dependency relationship

[batch-processor]: https://github.com/open-telemetry/opentelemetry-collector/tree/main/processor/batchprocessor/README.md
[batch-processor-preserve-metadata]: https://github.com/open-telemetry/opentelemetry-collector/tree/main/processor/batchprocessor/README.md#batching-and-client-metadata

[alpha]: https://github.com/open-telemetry/opentelemetry-collector#alpha
[contrib]: https://github.com/open-telemetry/opentelemetry-collector-releases/tree/main/distributions/otelcol-contrib
[Mimir]: https://grafana.com/oss/mimir/
[Tempo]: https://grafana.com/oss/tempo/
[Loki]: https://grafana.com/oss/loki/