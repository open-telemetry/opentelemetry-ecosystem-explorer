> **NOTE**: Refer to _[Difference to the current google pub sub receiver](#difference-to-the-current-google-pub-sub-receiver)_ if you don't know which receiver to use or just want to understand the differences.

The `googlecloudpubsubpush` receiver ingests OpenTelemetry data through Google Cloud Pub/Sub push subscriptions, supporting two primary data ingestion patterns:
 - Direct Log Ingestion: Processes Pub/Sub messages containing log data directly.
 - GCS Event Processing: Handles Pub/Sub notifications for new files in Google Cloud Storage.

All received data is parsed into OpenTelemetry format using configurable encoding extensions, enabling flexible and near real-time telemetry collection from multiple Google Cloud sources.

## Example configuration

```yaml
receivers:
  googlecloudpubsubpush:
    endpoint: :8080
    encoding: google_cloud_logentry_encoding

extensions:
  google_cloud_logentry_encoding:
```

## Difference to the current google pub sub receiver

The main difference between the current [`googlecloudpubsub` receiver](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/receiver/googlecloudpubsubreceiver)
and the proposed new receiver lies in how they receive messages from Google Pub/Sub: pull vs. push subscriptions. The table below summarizes their differences:

|    Component     |                  `googlecloudpubsub`                  |        `googlecloudpubsubpush`  (this receiver)         |
|:----------------:|:-----------------------------------------------------:|:-------------------------------------------------------:|
| **Subscription** |                         Pull                          |                          Push                           |
|  **Data Flow**   | The receiver _polls_ Pub/Sub to ask for new messages. | Pub/Sub actively *pushes* new messages to the receiver. |
|  **Initiator**   |                       Receiver                        |                         Pub/Sub                         |

You can read more about Pull/Push subscriptions in the [official documentation](https://cloud.google.com/pubsub/docs/subscriber#subscription_type_comparison).
