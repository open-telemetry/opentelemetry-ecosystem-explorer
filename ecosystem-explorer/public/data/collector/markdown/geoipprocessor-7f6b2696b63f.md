## Configuration

To add geographical information, the IP address must be included in the attributes specified by the `attributes` configuration option (e.g., [`client.address`](https://github.com/open-telemetry/semantic-conventions/blob/v1.29.0/docs/general/attributes.md#client-attributes) and [`source.address`](https://github.com/open-telemetry/semantic-conventions/blob/v1.29.0/docs/general/attributes.md#source) by default). By default, only the resource attributes will be modified. Please refer to [config.go](./config.go) for the config spec.

### Geographical location metadata

The following [resource attributes](./internal/convention/attributes.go) will be added if the corresponding information is found:

  - geo.city_name
  - [geo.postal_code](https://github.com/open-telemetry/semantic-conventions/blob/v1.34.0/model/geo/registry.yaml#L71)
  - geo.country_name
  - [geo.country.iso_code](https://github.com/open-telemetry/semantic-conventions/blob/v1.34.0/model/geo/registry.yaml#L53)
  - geo.continent_name
  - [geo.continent.code](https://github.com/open-telemetry/semantic-conventions/blob/v1.34.0/model/geo/registry.yaml#L19)
  - geo.region_name
  - [geo.region.iso_code](https://github.com/open-telemetry/semantic-conventions/blob/v1.34.0/model/geo/registry.yaml#L78)
  - geo.timezone
  - [geo.location.lat](https://github.com/open-telemetry/semantic-conventions/blob/v1.34.0/model/geo/registry.yaml#L65)
  - [geo.location.lon](https://github.com/open-telemetry/semantic-conventions/blob/v1.34.0/model/geo/registry.yaml#L59)

## Configuration

The following settings can be configured:

- `providers`: A map containing geographical location information providers. These providers are used to search for the geographical location attributes associated with an IP. Supported providers:
  - [maxmind](./internal/provider/maxmindprovider/README.md)
- `context` (default: `resource`): Allows specifying the underlying telemetry context the processor will work with. Available values:
  - `resource`: Resource attributes.
  - `record`: Attributes within a data point, log record or a span.
- `attributes` (default: `[client.address, source.address]`): An array of attribute names, which are used for the IP address lookup.

- `error_mode` (default: `propagate`): Determines how the processor reacts to errors that occur while looking up geolocation data for an IP address. Available values:
  - `propagate`: Log the error and return it, halting processing of the telemetry item.
  - `ignore`: Log the error and continue processing (the geolocation attributes are simply not added).
  - `silent`: Continue processing without logging the error.

## Examples

```yaml
processors:
    # processor name: geoip
    geoip:
      providers:
        maxmind:
          database_path: /tmp/mygeodb
      context: record
      attributes: [client.address, source.address, custom.address]
```
