## Configuration

The following settings are available:

| Setting | Type | Required | Description |
|---------|------|----------|-------------|
| `devices` | list | Yes | List of Cisco devices to monitor |
| `collection_interval` | duration | No | How often to collect metrics (default: 60s) |
| `timeout` | duration | No | SSH connection and command timeout (default: 30s) |
| `scrapers` | map | Yes | Scrapers to enable |

### Device Configuration

Each entry in the `devices` list contains device information and authentication settings:

| Setting | Type | Required | Description |
|---------|------|----------|-------------|
| `name` | string | No | Human-readable device name |
| `host` | string | Yes | Device IP address or hostname |
| `port` | int | Yes | SSH port (typically 22) |
| `auth.username` | string | Yes | SSH username for authentication |
| `auth.password` | string | No* | Password for authentication |
| `auth.key_file` | string | No* | Path to SSH private key file (supports RSA, ECDSA, Ed25519 in PEM or OpenSSH format) |

*At least one of `auth.password` or `auth.key_file` is required. Both can be provided for fallback authentication (key file is tried first).

**Authentication Methods:**
- **Password authentication**: Provide `auth.password`
- **SSH key file authentication**: Provide `auth.key_file` (path to private key)
  - Supports unencrypted keys in RSA, ECDSA, Ed25519 formats
  - Supports both PEM and OpenSSH formats
  - Encrypted keys are not supported
- **Fallback authentication**: Provide both `auth.password` and `auth.key_file`
  - Key file is tried first, password is used as fallback if key authentication fails

### Scrapers Configuration

The scrapers are configured as modular components. Each scraper type can be configured individually:

| Setting | Type | Description |
|---------|------|-------------|
| `system` | map | System metrics (device availability, CPU, memory) |
| `interfaces` | map | Interface metrics (traffic, errors, status) |

## Metrics Collected

### System Metrics
- `cisco.device.up` - Device availability (1=up, 0=down)
- `system.cpu.utilization` - CPU utilization as a percentage (0-1)
  - NX-OS: Calculated from `show system resources` (user + kernel)
  - IOS/IOS XE: Calculated from `show process cpu` (5-second average)
- `system.memory.utilization` - Memory utilization as a percentage (0-1)
  - NX-OS: Calculated from `show system resources` (used / total)
  - IOS/IOS XE: Calculated from `show process memory` (Processor Pool used / total)

### Interface Metrics
- `system.network.io` - Number of bytes transmitted and received (with `network.io.direction` attribute: `receive` or `transmit`)
- `system.network.errors` - Number of errors encountered (with `network.io.direction` attribute: `receive` or `transmit`)
- `system.network.packet.dropped` - Number of packets dropped (with `network.io.direction` attribute: `receive` or `transmit`)
- `system.network.packet.count` - Number of packets transmitted or received, categorized by type (with `network.packet.type` attribute: `multicast` or `broadcast`)
- `system.network.interface.status` - Interface operational status (1 = up, 0 = down)

Interface metrics include attributes: `network.interface.name`, `network.interface.mac`, `network.interface.description`, `network.interface.speed`

Metrics with direction attribute also include: `network.io.direction` (enum: `receive`, `transmit`)

Metrics with packet type attribute also include: `network.packet.type` (enum: `multicast`, `broadcast`)

### Resource Attributes
All metrics include the following resource attributes following OpenTelemetry semantic conventions:
- `host.ip` - Device IP address for correlation with Kubernetes nodes and other resources
- `hw.type` - Hardware type, set to "network" per OpenTelemetry hardware.network conventions
- `os.name` - Operating system name (e.g., "NX-OS", "IOS XE", "IOS")

## Example Configuration

```yaml
receivers:
  ciscoos:
    collection_interval: 60s
    timeout: 30s
    scrapers:
      system:
      interfaces:
    devices:
      - name: "core-switch-01"
        host: "192.168.1.10"
        port: 22
        auth:
          username: "admin"
          password: "secure-password"
      - name: "edge-router-01"
        host: "192.168.1.20"
        port: 22
        auth:
          username: "admin"
          key_file: "/home/user/.ssh/id_rsa"

exporters:
  debug:

service:
  pipelines:
    metrics:
      receivers: [ciscoos]
      exporters: [debug]
```