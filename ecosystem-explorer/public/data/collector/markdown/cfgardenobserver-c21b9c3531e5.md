Cloud Foundry (CF) is a platform as a service (PaaS) which has implemented their own container technology. The component in charge of providing a local API in each node (also known as "diego-cell") is named Garden.

The `cfgarden_observer` looks at the current host to discover Garden containers.

## Example Config

```yaml
extensions:
  cfgarden_observer:
    refresh_interval: 30s
    cache_sync_interval: 10m
    include_app_labels: true
    garden:
      endpoint: my/path/to/garden.sock
    cloud_foundry:
      endpoint: https://api.cf.mydomain.com
      auth:
        type: client_credentials
        client_id: myclientid
        client_secret: myclientsecret

receivers:
  receiver_creator:
    watch_observers: [cfgarden_observer]
    receivers:
      prometheus_simple:
        rule: type == "container" && labels["prometheus.io/scrape"] == "true" 
        config:
          metrics_path: /metrics
          endpoint: '`endpoint`'
```

### Configuration

| Name                             | Type   | Default                                                   | Description                                                        |
| -------------------------------- | ------ | --------------------------------------------------------- | ------------------------------------------------------------------ |
| refresh_interval                 | string | 1m                                                        | Determines how often to look for changes in endpoints.             |
| cache_sync_interval              | string | 5m                                                        | Determines how often app metadata cache is refreshed               |
| include_app_labels               | bool   | false                                                     | Determines whether or not app labels get added to container labels |
| garden.endpoint                  | string | /var/vcap/data/garden/garden.sock                         | Path to garden socket.                                             |
| cloud_foundry.endpoint           | string | none. required when `include_app_labels` is set to `true` | CloudFoundry API endpoint                                          |
| cloud_foundry.auth.type          | string | none. required when `include_app_labels` is set to `true` | Authentication type, one of: user_pass, client_credentials, token  |
| cloud_foundry.auth.username      | string | none                                                      | Username (auth.type: user_pass)                                    |
| cloud_foundry.auth.password      | string | none                                                      | Password (auth.type: user_pass)                                    |
| cloud_foundry.auth.client_id     | string | none                                                      | Client ID (auth.type: client_credentials)                          |
| cloud_foundry.auth.client_secret | string | none                                                      | Client Secret (auth.type: client_credentials)                      |
| cloud_foundry.auth.access_token  | string | none                                                      | Access Token (auth.type: token)                                    |
| cloud_foundry.auth.refresh_token | string | none                                                      | Refresh Token (auth.type: token)                                   |


### Endpoint Variables

Endpoint variables exposed by this observer are as follows.

| Variable     | Description                                                                       |
| ------------ | --------------------------------------------------------------------------------- |
| type         | This value is always `container`                                                  |
| name         | Name of the Garden container associated to the port                               |
| labels       | map[string]string with labels set on the log_config tags and application resource |
| port         | Exposed port of the container                                                     |
| container_id | ID of the container                                                               |
| host         | Hostname or IP of the underlying host the container is running on                 |
| transport    | Transport protocol used by the endpoint (TCP or UDP)                              |
