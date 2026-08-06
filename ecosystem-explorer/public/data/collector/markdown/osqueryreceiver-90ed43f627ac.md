## Configuration

The following settings are required:

- `queries`: list of queries to run on an osquery daemon

The following settings are optional:

- `collection_interval` (default = 10s): How often queries are run on the system
- `extensions_socket` (default = `/var/osquery/osquery.em`): The osquery daemon's extension socket. Used to communicate with osquery on the system.

## Getting started

[osquery](https://osquery.io/) must be installed on the system where the collector is running. Once running as a daemon, the collector can connect to it using osquery's extension socket.

Example queries and data sources for querying are available in the [osquery docs](https://osquery.io/).

## Example configuration

```
  osquery:
    collection_internal: 10s
    extensions_socket: /var/osquery/osquery.em
    queries:
      - "select * from certificates"
      - "select * from block_devices"
```
