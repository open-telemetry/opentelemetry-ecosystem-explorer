# Review report templates

Every review, human or agent, reports with these templates. Post one page checklist (readiness) or
gap table (audit) per page as a comment on the review's sub-issue, followed by one finding draft per
finding. A human reviews each draft before opening it as an issue.

## Page checklist (readiness mode)

Set each result to `pass`, `fail`, or `n/a`. A `fail` needs evidence, and an `n/a` needs a reason
(for example, "tier 2" or "cross-cutting review").

```markdown
### `<route>` readiness review

- Tier: <1 | 2, decision: light review | keep>
- Reviewed on: <staging | local>, `main` at <short SHA>, <YYYY-MM-DD>
- Reviewer: <@handle | agent first pass, reviewed by @handle>

| Check                                              | Result | Evidence |
| -------------------------------------------------- | ------ | -------- |
| Legacy parity                                      |        |          |
| Layout integration                                 |        |          |
| Visual (dark and light; desktop, tablet, mobile)   |        |          |
| Design                                             |        |          |
| React Doctor                                       |        |          |
| Duplicated components                              |        |          |
| Accessibility                                      |        |          |
| i18n                                               |        |          |
| Performance                                        |        |          |
| Tests                                              |        |          |

- Findings: <links, or "none">
- DESIGN_V1.md updates: <links to the findings, or "none">
```

## Gap table (audit mode)

```markdown
### `<route>` audit

- Level: <shell | ecosystem | component>
- Reviewed on: <staging | local>, `main` at <short SHA>, <YYYY-MM-DD>

| Rule or node | Status | Where | Gap | Evidence | Data | Proposed |
| ------------ | ------ | ----- | --- | -------- | ---- | -------- |
|              |        |       |     |          |      |          |
```

## Finding draft

One problem per finding. Group failures that share a root cause into a single finding.

```markdown
Title: [V1] <Area>: <what is wrong, in user terms>
Labels: v1:finding, Explorer Website[, v1:blocker][, Collector Ecosystem | Java Ecosystem]
Milestone: V1 Launch
Parent: <review sub-issue number>

**Route:** `<route>` (tier <1 | 2>)
**Criterion:** <Functional regression | WCAG 2.1 AA | Missing i18n | Broken visual | Non-blocking: <kind>>

**What happens:** <observed behavior>

**Expected:** <expected behavior; for parity findings, what production does, with its URL>

**Steps to reproduce:**

1. <step>

**Evidence:** <screenshot, axe rule id and selector, or console error>

**Environment:** <staging | local>, `main` at <short SHA>, <browser>, <theme>, <viewport>
```
