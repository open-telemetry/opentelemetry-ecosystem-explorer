# PR Screenshots Workflow

Automated visual review screenshots for pull requests, captured at three viewport sizes and posted
as an inline PR comment.

## How it works

The workflow is split across three files to support fork PRs safely:

| File                      | Trigger                          | Token                                     | Responsibility                                                                 |
| ------------------------- | -------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------ |
| `screenshots-capture.yml` | `pull_request`                   | `contents: read`                          | Builds the app, captures screenshots, uploads artifacts                        |
| `screenshots-commit.yml`  | `workflow_run` (after capture)   | `contents: write`, `pull-requests: write` | Downloads artifacts, commits to `otelbot/screenshots` branch, posts PR comment |
| `screenshots-cleanup.yml` | `pull_request_target` (on close) | `contents: write`                         | Deletes the PR's subfolder from the `otelbot/screenshots` branch               |

**Why two workflows for capture + commit?** GitHub restricts fork PRs from running workflows with
write access. Splitting into a read-only capture phase and a write-capable commit phase (triggered
via `workflow_run`, not `pull_request`) means fork code never runs with elevated permissions — the
classic defense against the "Pwn Requests" attack.

**Why `pull_request_target` for cleanup?** The `pull_request` event from a fork gets a read-only
token, which can't push to the `otelbot/screenshots` branch. `pull_request_target` always runs with
write access even for fork PRs. The cleanup job only touches the `otelbot/screenshots` branch — it
never checks out any PR code.

## The `otelbot/screenshots` branch

Screenshots live on a dedicated orphan branch named `screenshots`, separate from the main history.
The layout is flat:

```text
screenshots (branch)
├── 377/
│   ├── desktop-home.png
│   ├── tablet-home.png
│   ├── mobile-home.png
│   ├── desktop-instrumentation-list.png
│   └── ...
├── 381/
│   └── ...
└── ...
```

The commit workflow creates the `otelbot/screenshots` branch automatically on first run. When a PR
closes, the cleanup workflow deletes its subfolder and commits the removal.

Raw content URLs follow the pattern:

```text
https://raw.githubusercontent.com/open-telemetry/opentelemetry-ecosystem-explorer/otelbot/screenshots/<pr>/<viewport>-<page>.png
```

These URLs are embedded directly in the PR comment as inline images.

## Triggering screenshots

Add the `add-screenshots` label to a PR. The capture job runs on label or new commit while the label
is present. The comment is created on first run and updated in place on subsequent runs.

## Viewport configuration

Viewports are defined at the top of `ecosystem-explorer/scripts/take-screenshots.mjs`:

```js
const VIEWPORTS = [
  { name: "desktop", width: 1800, height: 1200 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
];
```

Add, remove, or resize entries there. The `name` field becomes the filename prefix
(`desktop-home.png`) and the column header in the PR comment table.

## Adding or removing pages

Pages are captured sequentially inside the viewport loop in `take-screenshots.mjs`. To add a page,
navigate to the URL and call `page.screenshot()` with an appropriate name. To remove a page, delete
its navigation block.

The PR comment table is built from a hardcoded `pages` list in the `Build comment body` step of
`screenshots-commit.yml`. Update it to match any changes to the page set in the script.

## Fork PR limitations

For PRs from forks, the workflow still writes screenshots to the upstream `otelbot/screenshots`
branch and updates the PR comment there. In practice, that means the `add-screenshots` label is
generally applied by a maintainer or other trusted collaborator, since the screenshots are stored in
the upstream repo rather than in the contributor's fork.
