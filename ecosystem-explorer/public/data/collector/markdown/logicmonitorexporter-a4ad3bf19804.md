This exporter supports sending traces & logs to [Logicmonitor](https://www.logicmonitor.com/).

## Configuration Options
The following configuration options are supported:

`endpoint (required)`: The target base URL to send data to (e.g.: https://<company_name>.logicmonitor.com/rest). For logs, "/log/ingest" path will be appended by default.\
`api_token` : API Token of Logicmonitor

## Prerequisite
Below environment variable must be provided

| Key                  | Value        |
| ------               | ------       |
| LOGICMONITOR_ACCOUNT | Company name |

**NOTE**: For ingesting data into the Logicmonitor, either its API Token or Bearer Token is required.

## Example
##### Ingestion through API Token
Pass `access_id` and `access_key` through config.yaml as shown in example    ***OR***  
Set the environment variables `LOGICMONITOR_ACCESS_ID` and `LOGICMONITOR_ACCESS_KEY`
```yaml
  exporters:
    logicmonitor:
      endpoint: "https://<company_name>.logicmonitor.com/rest"
      api_token:
        access_id: "<access_id of logicmonitor>"
        access_key: "<access_key of logicmonitor>"
```
##### Ingestion through Bearer token

Pass bearer token as Authorization headers through config.yaml as shown in example ***OR***
Set the environment variable `LOGICMONITOR_BEARER_TOKEN`
```yaml
  exporters:
    logicmonitor:
      endpoint: "https://<company_name>.logicmonitor.com/rest"
      headers:
        Authorization: Bearer <bearer token of logicmonitor>
```
## Resource Mapping for Logs

As per the LogicMonitor's [Log Ingestion documentation](https://www.logicmonitor.com/support/lm-logs/sending-logs-to-the-lm-logs-ingestion-api), if more than one resource property exists, only the first property will be mapped. In case of OTLP logs, there can be multiple resource attributes and its order also cannot be guaranteed.

Recently we have made the resource mapping for logs more flexible. With that, any of the resource attributes present in the log matches can be considered for resource mapping.
But, this is not the default behaviour. In order to make the resource mapping flexible, you can configure the `resource_mapping_op` in the LogicMonitor's exporter.

```yaml
  exporters:
    logicmonitor:
      endpoint: https://company.logicmonitor.com/rest
      headers:
        Authorization: Bearer <token>
      logs:
        resource_mapping_op: "OR"
```

The value for `resource_mapping_op` can be `AND` or `OR`. The values are case-insensitive. 