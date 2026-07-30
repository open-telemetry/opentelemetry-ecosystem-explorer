## Overview
The Solarwinds APM Settings extension gets Solarwinds APM specific settings from Solarwinds APM collector and `/tmp/solarwinds-apm-settings.json` periodically.

## Configuration

Example:

```yaml
extensions:
  solarwindsapmsettings:
    endpoint: "<endpoint>"
    key: "<token>:<name>"
    interval: 10s
```

### endpoint (Required)
The APM collector endpoint which this extension calls `getSettings`. See [SolarWinds Observability SaaS: Data centers and endpoint URIs](https://documentation.solarwinds.com/en/success_center/observability/content/system_requirements/endpoints.htm) for our APM collector endpoints. The endpoint is in format `<host>:<port>`.

### key (Required)
The service key in format `<token>:<name>` for `getSettings` from Solarwinds APM collector. See [SolarWinds Observability SaaS: Add a service](https://documentation.solarwinds.com/en/success_center/observability/content/configure/configure-services.htm) for configuring a service key.

### interval (Optional)
Periodic interval to get Solarwinds APM specific settings from Solarwinds APM collector.

Minimum value: `5s`

Maximum value: `60s`

Value that is outside the boundary will be bounded to either the minimum or maximum value.

Default: `10s`
