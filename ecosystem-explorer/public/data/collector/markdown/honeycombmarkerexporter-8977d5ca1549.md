> **Note:** The exporter type has been renamed from `honeycombmarker` to `honeycomb_marker` to follow the
> snake_case naming convention. The old name `honeycombmarker` is preserved as a deprecated alias and
> will continue to work, but a deprecation warning will be logged at startup. Please update your
> configuration to use `honeycomb_marker:`.

This exporter allows creating [markers](https://docs.honeycomb.io/working-with-your-data/markers/), via the [Honeycomb Markers API](https://docs.honeycomb.io/api/tag/Markers#operation/createMarker), based on the look of incoming telemetry. 

The following configuration options are supported:

* `api_key` (Required): This is the API key for your Honeycomb account.
* `api_url` (Optional): This sets the hostname to send marker data to. If not set, will default to `https://api.honeycomb.io/`
* `markers` (Required): This is a list of configurations to create an event marker. 
  * `type` (Required): Specifies the marker type.
  * `rules` (Required): This is a list of [OTTL](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/pkg/ottl) rules that determine when to create an event marker. 
    * `log_conditions` (Required): A list of [OTTL log](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/pkg/ottl/contexts/ottllog) conditions that determine a match. The marker will be created if **ANY** condition matches.
  * `dataset_slug` (Optional): The dataset in which to create the marker. If not set, will default to `__all__`.
  * `message_key` (Optional): The key of the attribute whose value will be used as the marker's message. If necessary the value will be converted to a string.
  * `url_key` (Optional): The key of the attribute whose value will be used as the marker's url. If necessary the value will be converted to a string.

`log_conditions` accept both the legacy un-prefixed form (`body == "x"`) and the new OTTL path-context form (`log.body == "x"`). Resource and scope paths are also reachable via `resource.attributes["..."]`, `scope.name`, etc. Un-prefixed paths continue to work for now; the parser logs the rewritten statements on startup. It is recommended to switch to the new syntax to avoid breaking changes in the future.

Example:
```yaml
exporters:
  honeycomb_marker:
    api_key: {{env:HONEYCOMB_API_KEY}}
    markers:
      # Creates a new marker anytime the exporter sees a k8s event with a reason of Backoff
      - type: k8s-backoff-events
        rules:
          log_conditions:
            - IsMap(log.body) and IsMap(log.body["object"]) and log.body["object"]["reason"] == "Backoff"
      # Path-context syntax allows referencing resource and scope fields directly
      - type: deployment-events
        rules:
          log_conditions:
            - log.body["event"] == "deploy" and resource.attributes["service.name"] == "checkout"
```
