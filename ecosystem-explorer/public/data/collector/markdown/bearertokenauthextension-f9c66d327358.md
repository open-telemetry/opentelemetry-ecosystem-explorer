This extension implements both `configauth.ServerAuthenticator` and `configauth.ClientAuthenticator`. It can be used in both http and gRPC exporters inside the `auth` settings, as a means to embed a static token for every RPC call that will be made.

The authenticator type has to be set to `bearertokenauth`.

## Configuration

- `header`: Specifies the auth header name. Defaults to "Authorization". Optional.

- `scheme`: Specifies the auth scheme name. Defaults to "Bearer". Optional.

- `token`: Static authorization token that needs to be sent on every gRPC client call as metadata.

- `tokens`: A list of static authorization tokens, one of which needs to be sent on every gRPC client call as metadata.

- `filename`: Name of file that contains authorization tokens. The file is parsed line by line. On each line, the first whitespace-delimited string is treated as the token. Any text following the first whitespace is ignored and can be used for comments (e.g., `my-token # comment` or `my-token // comment`).

Either one of `token` or `filename` field is required. If both are specified, then the `token` field value is **ignored**. In any case, the value of the token will be prepended by `${scheme}` before being sent as a value of "authorization" key in the request header in case of HTTP and metadata in case of gRPC.

**Note**: bearertokenauth requires transport layer security enabled on the exporter.


```yaml
extensions:
  bearertokenauth:
    token: "somerandomtoken"
    filename: "file-containing.token"
  bearertokenauth/withscheme:
    scheme: "Bearer"
    token: "randomtoken"
  bearertokenauth/multipletokens:
    scheme: "Bearer"
    tokens:
      - "randomtoken"
      - "thistokenalsoworks"

receivers:
  hostmetrics:
    scrapers:
      memory:
  otlp:
    protocols:
      grpc:

exporters:
  otlp_grpc/withauth:
    endpoint: 0.0.0.0:5000
    ca_file: /tmp/certs/ca.pem
    auth:
      authenticator: bearertokenauth

  otlp_http/withauth:
    endpoint: http://localhost:9000
    auth:
      authenticator: bearertokenauth/withscheme

service:
  extensions: [bearertokenauth, bearertokenauth/withscheme]
  pipelines:
    metrics:
      receivers: [hostmetrics]
      processors: []
      exporters: [otlp_grpc/withauth, otlp_http/withauth]
```
