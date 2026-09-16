The Sentry Exporter allows you to send traces and logs to [Sentry](https://sentry.io/).

## How routing works

- Telemetry is grouped per `project` and sent to that project's OTLP ingestion endpoint.
- The project slug comes from a resource attribute (default: `service.name`). If the attribute is missing or empty, the spans/logs in that resource are dropped with a warning.
- You can remap attribute values to project slugs with a lookup table.
- When `auto_create_projects` is enabled and a project is missing, the exporter enqueues it for asynchronous creation and drops data for that project until creation succeeds. If disabled, export fails permanently when a project is unknown.
- Project endpoints and keys are cached; a 403 for an unknown project ID triggers cache eviction and retry.
- Rate limits from Sentry response headers (or HTTP 429) are honored per DSN and category; limited data is dropped with a throttle error and retried by the queue.

## Configuration

Supported options:

- `url`: Base URL for the Sentry organization (required).
- `org_slug`: Target organization slug (required).
- `auth_token`: Authentication token with access to Sentry APIs (required).
  - basic functionality requires both `project:read` and `org:read` or higher
  - `auto_create_projects` requires `project:write` or higher. If your organization has disabled member project creation, the `org:write` or `team:admin` scope is required.
- `auto_create_projects` (default: `false`): Create missing projects using the first team found in the org.
- `routing`: Controls how telemetry is mapped to projects.
  - `project_from_attribute`: Resource attribute to use (default: `service.name`).
  - `attribute_to_project_mapping`: Optional map from attribute value to project slug.
- `http`: Standard `confighttp` client settings (timeout default 30s, TLS, headers, etc.).
- `timeout`: Exporter timeout (defaults to 30s).
- `sending_queue`: Optional queue settings (enabled by default with collector defaults).

Example:

```yaml
exporters:
  sentry:
    url: https://sentry.io
    org_slug: my-org
    auth_token: ${SENTRY_AUTH_TOKEN}
    auto_create_projects: true
    routing:
      project_from_attribute: service.name
      attribute_to_project_mapping:
        api-service: backend-api
        web-service: frontend-web
    http:
      timeout: 30s
      tls:
        insecure_skip_verify: false
    timeout: 30s
    sending_queue:
      enabled: true
```

### Known Limitations

- Manually deleting a project in Sentry while the exporter cache still holds its endpoints can drop data until a 403 is observed and the cache entry is evicted.
- When `auto_create_projects` is enabled, the first data for a missing project can be dropped while the async creation worker provisions the project and fetches its endpoints; pre-create projects to avoid startup loss.
- Retries are not possible, since a single collector batch can route to multiple projects. If one project export fails but others succeed, a retry would resend already accepted data, leading to potential duplication for the successful projects.

### Associating with Sentry Errors

This exporter does not maintain Sentry's trace connectedness by itself. When using the collector along with the sentry-go SDK, the Sentry OTLP Integration with option setup_otlp_traces_exporter=false should be used.
