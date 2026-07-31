This receiver reads logs and trace data from [Azure Blob Storage](https://azure.microsoft.com/en-us/products/storage/blobs/).

Each blob is expected to contain a single payload. By default the payload is decoded as OTLP/JSON, but the encoding is configurable per signal via `logs.encoding` and `traces.encoding` (see below). In addition to the built-in `otlp_json` and `otlp_proto` encodings, you may reference an [encoding extension](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/extension/encoding) by its component ID to decode other formats.

## Modes of Operation

The receiver supports two modes of operation:

1. **Event Hub mode** (recommended): Uses Azure Event Hub to receive notifications when new blobs are created. This is more efficient as it processes blobs immediately upon creation.

2. **Polling mode**: Periodically polls the blob containers for new blobs. Use this mode when Event Hub is not available or not desired. Blobs are processed and deleted every 10 seconds.

The mode is automatically selected based on whether `event_hub.endpoint` is configured.

## Configuration

The following settings can be optionally configured:

- `event_hub:`
  - `endpoint:` (no default): Azure Event Hub endpoint triggering on the `Blob Create` event. If not specified, the receiver uses polling mode.
- `auth` (default = connection_string): Specifies the used authentication method. Supported values are `connection_string`, `service_principal`, `default`.
- `cloud` (default = "AzureCloud"): Defines which Azure Cloud to use when using the `service_principal` authentication method. Value is either `AzureCloud` or `AzureUSGovernment`.
- `logs:`
  - `container_name:` (default = "logs"): Name of the blob container with the logs
  - `encoding:` (default = "otlp_json"): Encoding of log blob payloads. Either one of the built-in values `otlp_json` or `otlp_proto`, or the ID of an encoding extension that implements `plog.Unmarshaler`.
- `traces:`
  - `container_name:` (default = "traces"): Name of the blob container with the traces
  - `encoding:` (default = "otlp_json"): Encoding of trace blob payloads. Either one of the built-in values `otlp_json` or `otlp_proto`, or the ID of an encoding extension that implements `ptrace.Unmarshaler`.

Authenticating using a connection string requires configuration of the following additional setting:

- `connection_string:` Azure Blob Storage connection key, which can be found in the Azure Blob Storage resource on the Azure Portal.

Authenticating using service principal requires configuration of the following additional settings:

- `service_principal:`
  - `tenant_id`
  - `client_id`
  - `client_secret`
- `storage_account_url:` Azure Storage Account url



The service principal method also requires the [Storage Blob Data Contributor](https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles/storage#storage-blob-data-contributor) role on the logs and traces containers.

### Example configurations

Using Event Hub mode with connection string authentication:

```yaml
receivers:
  azure_blob:
    connection_string: DefaultEndpointsProtocol=https;AccountName=accountName;AccountKey=+idLkHYcL0MUWIKYHm2j4Q==;EndpointSuffix=core.windows.net
    event_hub:
      endpoint: Endpoint=sb://oteldata.servicebus.windows.net/;SharedAccessKeyName=otelhubbpollicy;SharedAccessKey=mPJVubIK5dJ6mLfZo1ucsdkLysLSQ6N7kddvsIcmoEs=;EntityPath=otellhub
```

Using Event Hub mode with service principal authentication:

```yaml
receivers:
  azure_blob:
    auth: service_principal
    service_principal:
      tenant_id: "${tenant_id}"
      client_id: "${client_id}"
      client_secret: "${env:CLIENT_SECRET}"
    storage_account_url: https://accountName.blob.core.windows.net
    event_hub:
      endpoint: Endpoint=sb://oteldata.servicebus.windows.net/;SharedAccessKeyName=otelhubbpollicy;SharedAccessKey=mPJVubIK5dJ6mLfZo1ucsdkLysLSQ6N7kddvsIcmoEs=;EntityPath=otellhub
```

Using polling mode (no Event Hub):

```yaml
receivers:
  azure_blob:
    connection_string: DefaultEndpointsProtocol=https;AccountName=accountName;AccountKey=+idLkHYcL0MUWIKYHm2j4Q==;EndpointSuffix=core.windows.net
```

Using an encoding extension to decode log blobs:

```yaml
extensions:
  text_encoding:

receivers:
  azure_blob:
    connection_string: DefaultEndpointsProtocol=https;AccountName=accountName;AccountKey=+idLkHYcL0MUWIKYHm2j4Q==;EndpointSuffix=core.windows.net
    logs:
      encoding: text_encoding
```

## Behavior

In **Event Hub mode**, the receiver subscribes to [blob events](https://docs.microsoft.com/en-us/azure/storage/blobs/storage-blob-event-overview) published by Azure Blob Storage and handled by Azure Event Hub. When it receives a `Blob Create` event, it reads the logs or traces from the corresponding blob and deletes it after processing.

In **polling mode**, the receiver periodically lists all blobs in the configured containers, processes each blob, and deletes it after processing.

