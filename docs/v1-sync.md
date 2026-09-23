# Sync main to v1

Use `sync-main-to-v1.yml` to merge remote `main` into the permanent `v1` preview branch on pushes to
`main`. For a manual run, select `main`. The job runs in the upstream repository once you set
`V1_SYNC_ENABLED=true`; it skips forks.

The workflow uses normal merges to preserve `v1` commits and its `netlify.toml`
`[context.v1.environment]` flags: `VITE_FEATURE_FLAG_V1_REDESIGN=true` and
`VITE_FEATURE_FLAG_DEV_SHOWCASE=true`. It stops on conflicts before pushing, without resetting
history or choosing a conflict resolution.

## Enable the workflow

1. Create a dedicated [fine-grained personal access token][pat-setup] named `V1_SYNC_TOKEN`. Set
   resource owner to `open-telemetry`, select **Only select repositories**, and select only
   `opentelemetry-ecosystem-explorer`. Grant **Contents: read and write** and **Workflows: read and
   write**; **Metadata: read** is automatic. Add no other permissions. Set a **30-day expiry** (or
   shorter if organization policy requires it).
2. The token owner must have write access to the repository. Complete any organization approval
   before relying on the token: a **pending** token cannot push, even if saved as a secret. If
   organization policy or membership prevents this setup, ask an organization owner to resolve it;
   do not substitute a classic PAT or broaden repository access.
3. Save the token as the upstream repository's Actions secret `V1_SYNC_TOKEN` under **Settings →
   Secrets and variables → Actions**. Do not paste it into logs, issues, or committed files. Record
   its expiry and rotate it before then: create a replacement with the same scope, obtain approval,
   update the secret, and revoke the old token. Secret metadata confirms storage, not token validity
   or organization approval.
4. Confirm that the token owner's pushes can satisfy `v1`'s branch rules. The PAT does not bypass
   required reviews, status checks, signed commits, or push restrictions. During setup on
   2026-09-22, the EasyCLA ruleset required a status from integration `17893` and allowed no bypass
   actors. A merge commit created on the runner lacks that status before push. The workflow reuses
   `.github/scripts/use-cla-approved-bot.sh`, but its commit author does not change the
   authenticated pusher or satisfy the required status. The `otelbot/**/*` exclusion does not cover
   `v1`. Maintainers must resolve these constraints through the repository's approved process.
5. Check that the existing Netlify project enables `v1` branch deploys, permits builds from the
   resulting commits, and retains both preview flags.
6. After review and merge, set `V1_SYNC_ENABLED=true` if it is not already enabled. It was enabled
   during setup on 2026-09-22. Run **Sync main to v1** on `main` only after code review and the
   token, branch-rule, and deployment checks, then verify the Netlify deploy and its commit SHA.

The workflow requires `V1_SYNC_TOKEN` and fails before checkout if it is missing. Checkout uses it
without persisting credentials; `GH_TOKEN` supplies it to `gh auth setup-git` for fetch and push.
Workflows permission allows pushes that include workflow-file changes. `GITHUB_TOKEN` [lacks that
permission][token-permissions], so there is no fallback. The sync no longer uses `OTELBOT_CLIENT_ID`
or `OTELBOT_PRIVATE_KEY`; other workflows still use those App credentials.

## Ordering and recovery

GitHub runs one sync job at a time and lets the active run finish. It can replace pending runs or
start them out of order. Each run fetches the current branch tips, so a delayed run includes changes
beyond its triggering commit.

If another writer advances `v1` before the push, Git rejects the stale push. The job merges the new
tip and retries, with a limit of three attempts. It uses no force push.

Resolve conflicts through the repository's review process with a normal merge of `main` into `v1`,
preserving the preview flags. For a rejected push, check token expiry, revocation, organization
approval, permissions, and branch rules. Rerun the workflow on `main` after fixing the cause. To
stop future jobs, set `V1_SYNC_ENABLED=false` and cancel any active run.

## Triggers and Netlify

GitHub [suppresses push workflows for pushes made with `GITHUB_TOKEN`][triggers]. If another
automation uses that token to update `main`, dispatch the sync on `main` or change that automation
to use an App token. Commit-message skip directives can suppress push runs too.

The sync's PAT-authenticated push can start workflows that include `v1` in their branch filters.
This workflow accepts `main`, which prevents a sync loop. Workflows restricted to `main` skip the
`v1` push.

You must [enable branch deploys in Netlify][branch-deploys] and check whether your project requires
approval for [untrusted authors or sensitive variables][netlify-variables]. During implementation,
we confirmed both flags in remote `v1` but lacked Netlify dashboard access and deployment evidence.
Check the deploy in Netlify after a successful sync; the workflow reports the Git push result.

[pat-setup]:
  https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token
[token-permissions]:
  https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions
[triggers]:
  https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow#triggering-a-workflow-from-a-workflow
[branch-deploys]: https://docs.netlify.com/deploy/deploy-types/branch-deploys/
[netlify-variables]:
  https://docs.netlify.com/build/environment-variables/get-started/#sensitive-variable-policy
