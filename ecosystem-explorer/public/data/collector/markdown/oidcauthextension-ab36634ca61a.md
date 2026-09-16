This extension implements a `configauth.ServerAuthenticator`, to be used in receivers inside the `auth` settings. The authenticator type has to be set to `oidc`.

## Configuration

```yaml
extensions:
  oidc:
    providers:
      - issuer_url: http://localhost:8080/auth/realms/opentelemetry
        issuer_ca_path: /etc/pki/tls/cert.pem
        audience: account
        username_claim: email

receivers:
  otlp:
    protocols:
      grpc:
        auth:
          authenticator: oidc

processors:

exporters:
  debug:
    verbosity: detailed

service:
  extensions: [oidc]
  pipelines:
    traces:
      receivers: [otlp]
      processors: []
      exporters: [debug]
```

## Provider Matching

Although multiple OIDC providers can be configured, incoming tokens will only be verified against a single provider. This is done by decoding the token, extracting the `iss` claim, and checking the configured providers for one with a matching `issuer_url` field.

If no matching `issuer_url` is found, the extension will fail to authenticate with an error informing the caller that `no OIDC provider configured for the issuer`.

## Configuration Structure Change

Earlier versions of this extension only allowed configuring a single provider:
```yaml
extensions:
  oidc:
    issuer_url: http://localhost:8080/auth/realms/opentelemetry
    issuer_ca_path: /etc/pki/tls/cert.pem
```

Although this configuration is still accepted by the extension, it is deprecated and support for it will be dropped in the future.

## Configuring Public Keys

By default, this extension will use [OpenID Connect Discovery] to retrieve the set of public keys used to verify JWT signatures. While this data is cached, it does require the extension to be able to reach the provider endpoint at startup and periodically throughout the lifetime of the collector process.

Optionally, a `public_keys_file` can be configured on a per-provider basis. When configured, discovery is disabled and the provided file will be parsed as a [JWK Set]. The public keys contained in the set will be used to verify JWT signatures:
```yaml
extensions:
  oidc:
    providers:
      - issuer_url: http://localhost:8080/auth/realms/opentelemetry
        audience: account
        public_keys_file: /path/to/jwks.json
```

[OpenID Connect Discovery]: https://openid.net/specs/openid-connect-discovery-1_0-final.html
[JWK Set]: https://datatracker.ietf.org/doc/html/rfc7517#section-5

## Accessing JWT Claims

The OIDC extension allows you to access JWT claims in the processor context.
This allows you to implement custom labeling based on received JWT token claims.

```yaml
extensions:
  oidc:
    providers:
      - issuer_url: http://localhost:8080/auth/realms/opentelemetry
        audience: account

receivers:
  otlp:
    protocols:
      grpc:
        auth:
          authenticator: oidc

processors:
  resource:
    attributes:
      # Add predefined OIDC claims to the resource attributes
      - key: subject
        action: upsert
        from_context: auth.claims.subject

      # Adding dynamic claims from the JWT token
      - key: tenant_id
        action: upsert
        from_context: auth.claims.tenant_id
```

## Ignoring Issuer Validation

By default, the OIDC extension verifies that the `iss` claim in each incoming JWT matches the `issuer_url` of a configured provider.

To disable this validation, set `ignore_issuer: true` in the provider configuration. This option is only supported when exactly one provider is configured.

```yaml
extensions:
  oidc:
    providers:
      - issuer_url: http://localhost:8080/auth/realms/opentelemetry
        audience: account
        ignore_issuer: true
```