## Configuration

```yaml
extensions:
  ack:
    storage:
    max_number_of_partition: 1000000
    max_number_of_pending_acks_per_partition: 1000000

receivers:
  splunk_hec:
    ack_extension: ack

service:
  extensions: [ack]
  pipelines:
    logs:
      receivers: [splunk_hec]
```