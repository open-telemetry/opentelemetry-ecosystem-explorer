#!/usr/bin/env bash
# Cross-check the builder's tree digest against git, for every ecosystem in the archive plan.
#
# Git is the independent observer here. previous_digest and content_digest both come from the same
# tree_digest that decides publication, so if git sees a change between them that the digests miss,
# or the reverse, the digest is wrong. The check is only valid on the first build after a fresh
# checkout, where the tree before the build is HEAD. File modes are ignored because neither the
# digest nor the archives record them.
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "usage: $0 <archive-plan.json>" >&2
  exit 2
fi

plan=$1
data_root=ecosystem-explorer/public/data

if [ ! -r "$plan" ]; then
  echo "::error::cannot read the archive plan at $plan"
  exit 1
fi
if ! jq -e 'length > 0 and all(.[]; has("previous_digest") and (.content_digest | type == "string"))' \
  "$plan" >/dev/null; then
  echo "::error::$plan is empty, or has an entry without previous_digest or content_digest"
  exit 1
fi

failed=false
for eco in $(jq -r 'keys[]' "$plan"); do
  digest_changed=$(jq -r --arg e "$eco" '.[$e].previous_digest != .[$e].content_digest' "$plan")

  # Captured on its own so a failing git stops the script instead of reading as a clean tree.
  status=$(git -c core.fileMode=false status --porcelain --untracked-files=all -- "$data_root/$eco/")
  if [ -n "$status" ]; then
    git_changed=true
  else
    git_changed=false
  fi

  echo "$eco: git_changed=$git_changed digest_changed=$digest_changed"
  if [ "$git_changed" != "$digest_changed" ]; then
    echo "::error::$eco: git_changed=$git_changed but digest_changed=$digest_changed. The tree digest disagrees with git."
    failed=true
  fi
done

if [ "$failed" = "true" ]; then
  exit 1
fi
