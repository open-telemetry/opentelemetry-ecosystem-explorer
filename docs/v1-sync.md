# Sync main to v1

Use `sync-main-to-v1.yml` to merge remote `main` into the permanent `v1` preview branch on pushes to
`main`. For a manual run, select `main`. The job runs in the upstream repository once you set
`V1_SYNC_ENABLED=true`; it skips forks.

The workflow uses normal merges to preserve `v1` commits and its `netlify.toml`
`[context.v1.environment]` flags: `VITE_FEATURE_FLAG_V1_REDESIGN=true` and
`VITE_FEATURE_FLAG_DEV_SHOWCASE=true`. It stops on conflicts before pushing, without resetting
history or choosing a conflict resolution.

## Enable the workflow

1. Grant the `otelbot` GitHub App **Contents: write** and **Workflows: write** for this repository
   through your organization's approval process. The workflow uses the organization-provided
   `OTELBOT_CLIENT_ID` and `OTELBOT_PRIVATE_KEY` from the
   [screenshots workflow](screenshots-workflow.md). On 2026-09-22, the App had Members/Metadata read
   and Pull requests write, so it needed both additional permissions. The sync token limits access
   to this repository and Contents/Workflows.
2. Arrange approval for the App to push merge commits under `v1`'s branch rules. On 2026-09-22, the
   EasyCLA ruleset required a status from integration `17893` and allowed no bypass actors. A merge
   commit created on the runner lacks that status before push. We reuse
   `.github/scripts/use-cla-approved-bot.sh` from screenshots, but the `otelbot/**/*` ruleset
   exclusion covers `otelbot/screenshots`, not `v1`. Using the same commit author does not satisfy
   the required status.
3. Check that the existing Netlify project enables `v1` branch deploys, permits builds from the App,
   and retains both preview flags.
4. After review and merge, set `V1_SYNC_ENABLED=true`. Run **Sync main to v1** on `main`, then check
   the resulting Netlify deploy and its commit SHA.

You must configure App permissions, branch rules and Netlify outside this workflow. GitHub requires
[Workflows permission to push workflow-file changes][app-permissions]. `GITHUB_TOKEN` [lacks that
permission][token-permissions], so the sync uses the App token without a `GITHUB_TOKEN` fallback.

## Ordering and recovery

GitHub runs one sync job at a time and lets the active run finish. It can replace pending runs or
start them out of order. Each run fetches the current branch tips, so a delayed run includes changes
beyond its triggering commit.

If another writer advances `v1` before the push, Git rejects the stale push. The job merges the new
tip and retries, with a limit of three attempts. It uses no force push.

Resolve conflicts through the repository's review process with a normal merge of `main` into `v1`,
preserving the preview flags. For a rejected push, check App permissions and branch rules. Rerun the
workflow on `main` after fixing the cause. To stop future jobs, set `V1_SYNC_ENABLED=false` and
cancel any active run.

## Triggers and Netlify

GitHub [suppresses push workflows for pushes made with `GITHUB_TOKEN`][triggers]. If another
automation uses that token to update `main`, dispatch the sync on `main` or change that automation
to use an App token. Commit-message skip directives can suppress push runs too.

The sync's App-authenticated push can start workflows that include `v1` in their branch filters.
This workflow accepts `main`, which prevents a sync loop. Workflows restricted to `main` skip the
`v1` push.

You must [enable branch deploys in Netlify][branch-deploys] and check whether your project requires
approval for [untrusted authors or sensitive variables][netlify-variables]. During implementation,
we confirmed both flags in remote `v1` but lacked Netlify dashboard access and deployment evidence.
Check the deploy in Netlify after a successful sync; the workflow reports the Git push result.

[app-permissions]:
  https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app#choosing-permissions-for-git-access
[token-permissions]:
  https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions
[triggers]:
  https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow#triggering-a-workflow-from-a-workflow
[branch-deploys]: https://docs.netlify.com/deploy/deploy-types/branch-deploys/
[netlify-variables]:
  https://docs.netlify.com/build/environment-variables/get-started/#sensitive-variable-policy
