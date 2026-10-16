This extension implements both `configauth.ServerAuthenticator` and `configauth.ClientAuthenticator` to authenticate clients and servers using Basic Authentication. The authenticator type has to be set to `basicauth`.

When used as ServerAuthenticator, if the authentication is successful `client.Info.Auth` will expose the following attributes:

- `username`: The username of the authenticated user.
- `raw`: Raw base64 encoded credentials.

The configuration should specify only one instance of `basicauth` extension for either client or server authentication. 

The following are the configuration options:

- `htpasswd.file`:  The path to the htpasswd file.
- `htpasswd.inline`: The htpasswd file inline content.
- `htpasswd.secret_provider.id`: Component ID of a secret provider extension (e.g., `mysecretprovider/server`). The secret value must be htpasswd-formatted content.
- `client_auth.username`: Username to use for client authentication.
- `client_auth.username_file`: Path to a file containing the username. If set, takes precedence over `username`. The file is watched for changes, allowing rotation without restarting the collector.
- `client_auth.password`: Password to use for client authentication.
- `client_auth.password_file`: Path to a file containing the password. If set, takes precedence over `password`. The file is watched for changes, allowing rotation without restarting the collector.
- `client_auth.secret_provider.id`: Component ID of a secret provider extension (e.g., `mysecretprovider/client`). The secret value must be a JSON object.
- `client_auth.secret_provider.username_key`: JSON key for the username (required with `secret_provider`).
- `client_auth.secret_provider.password_key`: JSON key for the password (required with `secret_provider`).

To configure the extension as a server authenticator, one of `htpasswd.file`, `htpasswd.inline`, or `htpasswd.secret_provider` has to be set. If both file and inline are configured, `htpasswd.inline` credentials take precedence.

To configure the extension as a client authenticator, `client_auth` has to be set with either inline credentials, file-based credentials, or `secret_provider`.

Only one credential source is allowed per mode: `secret_provider` cannot be combined with inline or file options.

If both `htpasswd` and `client_auth` are configured, the extension will throw an error.

### Secret Provider

The `secret_provider` option delegates credential management to a separate extension that implements the `SecretProvider` interface (`GetSecret` + `OnChange`). This allows credentials to be fetched from external systems and automatically rotated without restarting the collector.

The referenced extension must be listed in `service.extensions` and will be started before `basicauth` automatically. A provider extension may be shared by several `basicauth` instances; it notifies every registered `OnChange` callback when the secret changes.

The examples below use `mysecretprovider` as a placeholder for any extension that implements the `SecretProvider` interface.

## Configuration

```yaml
extensions:
  basicauth/server:
    htpasswd: 
      file: .htpasswd
      inline: |
        ${env:BASIC_AUTH_USERNAME}:${env:BASIC_AUTH_PASSWORD}
  
  basicauth/client:
    client_auth: 
      username: username
      password: password

  # File-based credentials (watched for changes, enabling rotation without restart)
  basicauth/client_from_files:
    client_auth:
      username_file: /etc/secrets/username
      password_file: /etc/secrets/password

receivers:
  otlp:
    protocols:
      http:
        auth:
          authenticator: basicauth/server

processors:

exporters:
  otlp_grpc:
    auth:
      authenticator: basicauth/client

service:
  extensions: [basicauth/server, basicauth/client]
  pipelines:
    traces:
      receivers: [otlp]
      processors: []
      exporters: [otlp_grpc]
```

### Server with secret provider

```yaml
extensions:
  # Any extension that implements the SecretProvider interface.
  mysecretprovider/server:
    # Provider-specific settings, such as the secret's location and refresh interval.

  basicauth/server:
    htpasswd:
      secret_provider:
        id: mysecretprovider/server

receivers:
  otlp:
    protocols:
      http:
        auth:
          authenticator: basicauth/server

processors:

exporters:
  debug:

service:
  extensions: [mysecretprovider/server, basicauth/server]
  pipelines:
    traces:
      receivers: [otlp]
      processors: []
      exporters: [debug]
```

### Client with secret provider

```yaml
extensions:
  # Any extension that implements the SecretProvider interface.
  mysecretprovider/client:
    # Provider-specific settings, such as the secret's location and refresh interval.

  basicauth/client:
    client_auth:
      secret_provider:
        id: mysecretprovider/client
        username_key: "username"
        password_key: "password"

receivers:
  otlp:
    protocols:
      http:
        endpoint: 0.0.0.0:4318

processors:

exporters:
  otlp_grpc:
    auth:
      authenticator: basicauth/client

service:
  extensions: [mysecretprovider/client, basicauth/client]
  pipelines:
    traces:
      receivers: [otlp]
      processors: []
      exporters: [otlp_grpc]
```