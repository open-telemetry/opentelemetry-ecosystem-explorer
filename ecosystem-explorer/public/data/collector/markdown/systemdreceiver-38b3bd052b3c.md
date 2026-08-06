This scraper generates a metric with a label for service state with a value of `1` if the unit is in that state. For
example, the following metrics will be generated if the `nginx` service is currently active:

```
systemd.unit.state{systemd.unit.name="nginx", systemd.unit.active_state="active"} = 1
systemd.unit.state{systemd.unit.name="nginx", systemd.unit.active_state="reloading"} = 0
systemd.unit.state{systemd.unit.name="nginx", systemd.unit.active_state="inactive"} = 0
systemd.unit.state{systemd.unit.name="nginx", systemd.unit.active_state="failed"} = 0
systemd.unit.state{systemd.unit.name="nginx", systemd.unit.active_state="activating"} = 0
systemd.unit.state{systemd.unit.name="nginx", systemd.unit.active_state="deactivating"} = 0
systemd.unit.state{systemd.unit.name="nginx", systemd.unit.active_state="maintenance"} = 0
systemd.unit.state{systemd.unit.name="nginx", systemd.unit.active_state="refreshing"} = 0
```

## Configuration

| Field   | Default          | Description                                                          |
|---------| -----------------| ---------------------------------------------------------------------|
| `scope` | `system`         | The service manager to gather units from, either `system` or `user`. |
| `units` | `["*.service"]`  | The units to scrape, as a list of [patterns].                        |

[patterns]: https://www.freedesktop.org/software/systemd/man/latest/systemctl.html#Parameter%20Syntax

## Example
### Basic configuration
In its default configuration, the systemd receiver will scrape all system-level services:

```yaml
  receivers:
    systemd:
```

### Advanced configuration

```yaml
  receivers:
    systemd:
        scope: user
        units: ["emacs.service"]
```
