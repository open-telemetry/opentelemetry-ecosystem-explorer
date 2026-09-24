# Timeline event audit

## Selection rule

Keep domain/signal introductions, explicit compatibility baselines, scoped maturity transitions,
substantial telemetry-model migrations, removals, and domain repository moves. The expanded view can
include narrower domain introductions. Project-wide release-process milestones and model/tooling
policies are background context, outside this timeline. An isolated attribute rename, a
documentation repair, or several unrelated changes sharing a release is not enough to justify a
marker. Major events should explain the evolution of their lane.

The five remaining background events and their Model + lifecycle lane were removed in the follow-up
cleanup. Model / tooling and Release process are no longer event categories. The legend shows only
categories present after applying the scope, domain, and event-type filters.

## Verification

- Reviewed every pre-audit non-baseline event against the
  [v1.44.0 changelog](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md),
  with PRs and versioned documents where chronology or scope was ambiguous.
- Verified all post-split event release dates against GitHub release `published_at` metadata.
  Earlier dates match the specification-era changelog headings. No existing release dates needed
  changing.
- Verified the six pre-release origin/generalization events against their commit diffs and UTC
  committer dates. GitHub comparisons confirm the listed first containing tags; the immediately
  preceding tags exclude the later Kubernetes, messaging, and generic-RPC changes.
  HTTP/database/gRPC are contained in the earliest tag, `0.1`.
- Verified the May 13, 2019 imported-draft commit and the referenced draft paths.
- The seven compatibility baselines are covered in [README.md](README.md) and retained unchanged.

## HTTP chronology

`http.user_agent` was renamed in v1.19.0, and `http.flavor` was replaced in v1.20.0. The author of
[PR #503](https://github.com/open-telemetry/semantic-conventions/pull/503) explicitly describes the
v1.24.0 addition to the deprecated-attribute list as recording attributes already deprecated by
v1.20.0. It is not evidence of deprecation beginning after stabilization. The timeline now shows the
compatibility baseline, the v1.21.0 feature freeze/transition plan, and v1.23.0 core stability. The
[v1.21.0 HTTP document](https://github.com/open-telemetry/semantic-conventions/blob/v1.21.0/docs/http/http-spans.md)
explicitly calls the conventions experimental and feature-frozen and includes the migration plan.

## Existing event decisions

Each source below is the original event evidence; replacement/addition sources are in the dataset.

| Event ID                   | Decision | Evidence and rationale                                                                                                                                                                                                                                                                        |
| -------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `first-release`            | Remove   | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v100-2021-02-10). Specification v1.0 is a project release boundary, not a domain origin or stability milestone.                                                                                     |
| `requirements-stable`      | Remove   | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1200-2023-04-07). Shared authoring requirements do not describe the maturity of a telemetry domain.                                                                                                |
| `separate-repo`            | Remove   | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1210-2023-07-13). The separate release stream is background version-history context, not a domain transition.                                                                                      |
| `entities-and-deprecation` | Remove   | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1340). Schema and code-generation changes do not themselves change emitted telemetry or domain maturity.                                                                                           |
| `entity-policies`          | Remove   | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1360). Registry and stabilization policies concern convention authoring rather than a domain lifecycle event.                                                                                      |
| `distro-stable`            | Remove   | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1410). Accurate individual attribute/entity promotions, but an arbitrary bundle in the model/lifecycle lane.                                                                                       |
| `generic-signal-docs`      | Remove   | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1430). Documentation consolidation does not mark a domain lifecycle change.                                                                                                                        |
| `http-stable`              | Clarify  | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1230-2023-11-03). Keep first stable core release; put the preceding migration in context.                                                                                                          |
| `http-deprecations`        | Replace  | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1240-2023-12-15). v1.24.0 only repaired the deprecated-attribute list. Replace with the v1.21.0 HTTP feature freeze and transition plan.                                                           |
| `db-rc`                    | Clarify  | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1280). Keep core RC milestone without implying every database system is RC.                                                                                                                        |
| `db-stable`                | Keep     | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1330). First stable core release, with selected SQL systems explicitly named.                                                                                                                      |
| `rpc-deprecations`         | Remove   | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1390). Bundles renames, a method/service merge, protocol status deprecations, and unrelated peer.service. Migration context now accompanies the RPC RC milestone.                                  |
| `rpc-rc`                   | Clarify  | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1400). Keep scoped core/gRPC/Dubbo RC and migration guide; avoid treating all RPC as stable.                                                                                                       |
| `jvm-stable`               | Clarify  | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1240-2023-12-15). Remove unrelated TLS/SSL material; scope stability to the core JVM metrics.                                                                                                      |
| `cpython`                  | Narrow   | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1320). The actual introduction is CPython garbage-collector metrics, not all Python runtime telemetry.                                                                                             |
| `k8s-alpha`                | Narrow   | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1390). The promotion covers selected Kubernetes/container attributes, not the whole domain.                                                                                                        |
| `k8s-container-stable`     | Clarify  | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1420). Registry means the semantic-convention attribute registry, not container-image registries. Separate attribute and metric maturity.                                                          |
| `cpu-rc`                   | Replace  | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1420). Narrow to process attributes (process-attributes-rc). The CPU time metrics cited in this release belong to Kubernetes/container, not generic system CPU metrics.                            |
| `process-k8s-rc`           | Replace  | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1440). Process metrics/entity became RC in v1.43.0. v1.44.0 refers back to that fact. Separate process-rc and k8s-memory-rc and drop the isolated network-interface attribute.                     |
| `kafka-metrics`            | Keep     | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1120-2022-06-10). An identifiable experimental metric surface with a later removal.                                                                                                                |
| `kafka-removed`            | Keep     | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1220-2023-10-12). Removal closes that experimental metric surface; does not mean Kafka tracing was removed.                                                                                        |
| `messaging-rework`         | Clarify  | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1270). Keep the common operation/metric model change across messaging systems. Fix broken changelog anchor: heading is 1.27.0, without v.                                                          |
| `vcs-metrics`              | Keep     | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1290). Introduces a VCS signal surface.                                                                                                                                                            |
| `cicd-vcs-resources`       | Keep     | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1330). Introduces CI/CD spans/resources and VCS resources within the shared delivery lane.                                                                                                         |
| `cicd-vcs-rc`              | Clarify  | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1430). Keep delivery maturity milestone; process now has its own event.                                                                                                                            |
| `messaging-spans`          | Remove   | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1440). v1.44.0 defines separate convention groups for existing operation types; it is not the introduction of messaging operation spans. Kafka cluster identity is an isolated attribute addition. |
| `js-cloud-events`          | Split    | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1100-2022-04-01). Two unrelated introductions: JavaScript belongs in the runtime lane, CloudEvents in other domains.                                                                               |
| `graphql`                  | Keep     | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1130-2022-09-19). A domain introduction supported by the release changelog.                                                                                                                        |
| `feature-flags`            | Keep     | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1160-2022-12-08). A domain introduction supported by the release changelog.                                                                                                                        |
| `profiles`                 | Keep     | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1280). Introduces conventions for a new signal type.                                                                                                                                               |
| `cli-geo`                  | Split    | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1300). Independent CLI span and geographic-attribute domain introductions should be independently selectable.                                                                                      |
| `browser-vitals`           | Clarify  | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1330). Name the event signal explicitly and remove the future rewrite teaser.                                                                                                                      |
| `browser-document`         | Clarify  | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1420). A distinct entity with a navigation-dependent lifetime, not just a URL attribute addition; retain in expanded history.                                                                      |
| `web-vital-rework`         | Remove   | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1440). Moving event-body fields to attributes is schema detail, not a browser lifecycle milestone.                                                                                                 |
| `genai-introduced`         | Keep     | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1260). Introduces the GenAI client convention surface.                                                                                                                                             |
| `genai-events`             | Reframe  | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1280). Keep as a content/signal model migration, not an isolated pair of deprecated attributes.                                                                                                    |
| `genai-response`           | Remove   | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1310). An individual OpenAI response-format attribute replacement, not a domain lifecycle milestone.                                                                                               |
| `genai-chat-rework`        | Promote  | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1370). A substantive content-model migration after the baseline: per-message events become structured content on spans or an operation-details event.                                              |
| `genai-moved`              | Keep     | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1420). Repository ownership/lifecycle boundary; already distinguishes movement from domain removal.                                                                                                |
| `http-origin`              | Keep     | [Source](https://github.com/open-telemetry/opentelemetry-specification/commit/4ac49aa1e86633887f49ab1f58221b78b4888e24). Commit diff, UTC committer date, imported draft, and first containing tag verified.                                                                                  |
| `db-origin`                | Keep     | [Source](https://github.com/open-telemetry/opentelemetry-specification/commit/4d3dfa74937c977b4b90eb07971c3f8d1192ea7b). Commit diff, UTC committer date, imported draft, and first containing tag verified.                                                                                  |
| `rpc-origin`               | Keep     | [Source](https://github.com/open-telemetry/opentelemetry-specification/commit/f1b7b8a12e063a58dc9f27a40462e414288d2c0d). gRPC-specific origin; commit and first containing tag verified. Generic RPC remains separate.                                                                        |
| `messaging-origin`         | Keep     | [Source](https://github.com/open-telemetry/opentelemetry-specification/commit/6b296676983a88ef2528ba90808ab1d6b9d50254). Dedicated messaging convention origin; commit and first containing tag verified.                                                                                     |
| `k8s-origin`               | Keep     | [Source](https://github.com/open-telemetry/opentelemetry-specification/commit/6a5af6b645cc0d6217efdabcdadf6c5e0ba1bc7d). Resource-attribute origin; commit and first containing tag verified, distinct from metrics.                                                                          |
| `jvm-memory`               | Keep     | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v190-2022-02-10). Precisely scoped start of selected JVM memory-to-stability history.                                                                                                               |
| `jvm-cpu`                  | Remove   | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1120-2022-06-10). Incremental metric expansion; not needed between the existing origin and stability milestones.                                                                                   |
| `browser-introduced`       | Keep     | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1120-2022-06-10). Browser attribute-domain introduction.                                                                                                                                           |
| `db-renames`               | Remove   | [Source](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1260). The listed v1.26.0 renames are accurate, but are implementation-level migration detail. Baseline → RC → stable tells the useful domain story.                                               |
| `rpc-generalized`          | Keep     | [Source](https://github.com/open-telemetry/opentelemetry-specification/commit/99b31d4510b7e62a3d89cfede4c0118e3de58650). Meaningful expansion beyond gRPC; commit and first containing tag verified.                                                                                          |

## Added or replacement milestones

| Event ID                | Release                                                                                                     | Rationale                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `process-attributes-rc` | [1.42.0](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1420)            | Scopes the former CPU/process bundle to process attributes.                       |
| `http-freeze`           | [1.21.0](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1210-2023-07-13) | Documents the actual pre-stability freeze and migration boundary.                 |
| `k8s-attributes-rc`     | [1.41.0](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1410)            | Fills the verified RC step between selected attributes reaching alpha and stable. |
| `k8s-cpu-rc`            | [1.42.0](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1420)            | Places CPU time metric maturity in the domain the source actually names.          |
| `process-rc`            | [1.43.0](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1430)            | Corrects the release to v1.43.0 and separates it from Kubernetes/network changes. |
| `k8s-memory-rc`         | [1.44.0](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1440)            | Preserves the verified v1.44.0 memory-metric promotion in the Kubernetes lane.    |
| `javascript-runtime`    | [1.10.0](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1100-2022-04-01) | Splits JavaScript from CloudEvents and uses the runtime lane.                     |
| `cloudevents`           | [1.10.0](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1100-2022-04-01) | Separates an unrelated domain introduction.                                       |
| `cli`                   | [1.30.0](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1300)            | Separates CLI spans from geographic attributes.                                   |
| `geo`                   | [1.30.0](https://github.com/open-telemetry/semantic-conventions/blob/v1.44.0/CHANGELOG.md#v1300)            | Separates a reusable attribute-domain introduction from CLI spans.                |

This audit covers the curated dataset, not an exhaustive inventory of every upstream convention or
every historical change. A missing marker is not evidence that a domain had no activity.
