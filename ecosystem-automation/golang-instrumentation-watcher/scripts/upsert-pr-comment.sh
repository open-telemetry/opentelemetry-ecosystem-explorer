#!/usr/bin/env bash
# Reads markdown from stdin and upserts it as a PR comment identified by
# the sentinel string "<!-- otel-go-snapshot -->". Creates a new comment if
# none exists; patches the existing one if found.
set -euo pipefail

SENTINEL="<!-- otel-go-snapshot -->"

TMPFILE=$(mktemp --suffix=.md)
trap "rm -f ${TMPFILE}" EXIT
cat > "${TMPFILE}"

PR_NUMBER=$(gh pr view --json number -q .number 2>/dev/null) || {
    echo "No open PR for the current branch. Output written to stdout only:" >&2
    cat "${TMPFILE}"
    exit 0
}
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)

COMMENT_ID=$(gh api "repos/${REPO}/issues/${PR_NUMBER}/comments" --paginate \
    --jq ".[] | select(.body | contains(\"${SENTINEL}\")) | .id" \
    | head -1)

if [ -n "${COMMENT_ID}" ]; then
    gh api --method PATCH "repos/${REPO}/issues/comments/${COMMENT_ID}" \
        --field "body=@${TMPFILE}" > /dev/null
    echo "Updated comment ${COMMENT_ID} on PR #${PR_NUMBER} (${REPO})"
else
    gh api --method POST "repos/${REPO}/issues/${PR_NUMBER}/comments" \
        --field "body=@${TMPFILE}" > /dev/null
    echo "Created snapshot comment on PR #${PR_NUMBER} (${REPO})"
fi
