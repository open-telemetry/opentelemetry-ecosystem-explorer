## Configuration

The configuration fields are as follows:

* `assume_role`: **Optional**. Specifies the configuration needed to assume a role
  * `arn`: The Amazon Resource Name (ARN) of a role to assume
  * `session_name`: **Optional**. The name of a role session
  * `web_identity_token_file`: The path to the file containing the JWT token to be exchanged
  * `sts_region`: The AWS region where STS is used to assumed the configured role
    * Note that if a role is intended to be assumed, and `sts_region` is not provided, then `sts_region` will default to the value for `region` if `region` is provided
  * `external_id`: **Optional**. A unique identifier used when assuming a role in cross-account scenarios to prevent the confused deputy problem
* `region`: **Optional**. The AWS region for the service you are exporting to for AWS Sigv4. This is differentiated from `sts_region` to handle cross region authentication
    * Note that an attempt will be made to obtain a valid region from the endpoint of the service you are exporting to
    * [List of AWS regions](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.RegionsAndAvailabilityZones.html)
* `service`: **Optional**. The AWS service for AWS Sigv4
    * Note for supported services an attempt will be made to obtain a valid service from the endpoint of the service you are exporting to. Supported services include - workspaces, es, logs and traces.


## Assume Role

### Example Configuration:

```yaml
extensions:
  sigv4auth:
    assume_role:
      arn: "arn:aws:iam::123456789012:role/aws-service-role/access"
      sts_region: "us-east-1"

receivers:
  hostmetrics:
    scrapers:
      memory:

exporters:
  prometheus_remote_write:
    endpoint: "https://aps-workspaces.us-west-2.amazonaws.com/workspaces/ws-XXX/api/v1/remote_write"
    auth:
      authenticator: sigv4auth

service:
  extensions: [sigv4auth]
  pipelines:
    metrics:
      receivers: [hostmetrics]
      processors: []
      exporters: [prometheus_remote_write]
```

## Notes

* The collector must have valid AWS credentials as used by the [AWS SDK for Go](https://docs.aws.amazon.com/sdk-for-go/v2/developer-guide/configure-gosdk.html#specifying-credentials)


## Assume Role with Web Identity

Configuring `web_identity_token_file` will cause the sigv4auth extension to exchange the token in the specified `web_identity_token_file` for AWS credentials. This is especially useful for authenticating from on-prem systems or other cloud providers via OIDC to publish telemetry to an AWS destination (e.g. Amazon Managed Prometheus).

### Prerequisites:

To utilize Assume Role with Web Identity with the sigv4 extension, an AWS IAM role must be setup to be able to be assumed via OIDC. Once established, a configuration like below can be used to assume that role and interact with AWS services. In kubernetes, the service account token is typically stored in `/var/run/secrets/kubernetes.io/serviceaccount/token`. Before implementing, ensure that the audience is included in the AWS OIDC provider, and the claims match any conditions in the IAM role trust policy.

### Example Configuration:

```yaml
extensions:
  sigv4auth:
    assume_role:
      arn: "arn:aws:iam::123456789012:role/aws-service-role/access"
      web_identity_token_file: "/var/run/secrets/kubernetes.io/serviceaccount/token"

receivers:
  hostmetrics:
    scrapers:
      memory:

exporters:
  prometheus_remote_write:
    endpoint: "https://aps-workspaces.us-west-2.amazonaws.com/workspaces/ws-XXX/api/v1/remote_write"
    auth:
      authenticator: sigv4auth

service:
  extensions: [sigv4auth]
  pipelines:
    metrics:
      receivers: [hostmetrics]
      processors: []
      exporters: [prometheus_remote_write]
```

## Assume Role with External ID

When assuming a role in cross-account authentication scenarios, an External ID can be specified to prevent the [confused deputy problem](https://docs.aws.amazon.com/IAM/latest/UserGuide/confused-deputy.html).

### Example Configuration:
```yaml
extensions:
  sigv4auth:
    assume_role:
      arn: "arn:aws:iam::123456789012:role/aws-service-role/access"
      sts_region: "us-east-1"
      external_id: "my-external-id"
```