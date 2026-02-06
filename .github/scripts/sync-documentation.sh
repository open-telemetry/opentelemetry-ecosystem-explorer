#!/bin/bash
set -e

# ============================================================================
# OpenTelemetry.io Documentation Sync Script
# ============================================================================
#
# This script synchronizes OpenTelemetry Collector component documentation
# from the ecosystem-registry to opentelemetry.io.
#
# Required environment variables:
#   GH_TOKEN            - GitHub token for pushing and creating PRs
#   SOURCE_FORK         - GitHub owner of the fork to push to (e.g., "otelbot" or user)
#   DESTINATION_REPO    - GitHub owner of the repo to create PR against (e.g., "open-telemetry")
#   GITHUB_REPOSITORY   - Current repository (e.g., "open-telemetry/opentelemetry-ecosystem-explorer")
#
# Optional environment variables:
#   OTEL_DOCS_REPO_PATH - Path to opentelemetry.io checkout (default: "opentelemetry.io")
# ============================================================================

# Validate required environment variables
if [ -z "$GH_TOKEN" ]; then
  echo "Error: GH_TOKEN environment variable is required"
  exit 1
fi

if [ -z "$SOURCE_FORK" ]; then
  echo "Error: SOURCE_FORK environment variable is required"
  exit 1
fi

if [ -z "$DESTINATION_REPO" ]; then
  echo "Error: DESTINATION_REPO environment variable is required"
  exit 1
fi

if [ -z "$GITHUB_REPOSITORY" ]; then
  echo "Error: GITHUB_REPOSITORY environment variable is required"
  exit 1
fi

OTEL_DOCS_REPO_PATH="${OTEL_DOCS_REPO_PATH:-opentelemetry.io}"

echo "Starting OpenTelemetry.io documentation sync"
echo ""

echo "Installing Python dependencies..."
uv sync

echo "Installing Node.js dependencies..."
cd "$OTEL_DOCS_REPO_PATH" || { echo "Error: Failed to change to directory $OTEL_DOCS_REPO_PATH"; exit 1; }
npm install --omit=optional
cd .. || { echo "Error: Failed to change to parent directory"; exit 1; }

echo "Generating documentation..."
export OTEL_DOCS_REPO_PATH
uv run documentation-sync

echo "Formatting documentation..."
cd "$OTEL_DOCS_REPO_PATH" || { echo "Error: Failed to change to directory $OTEL_DOCS_REPO_PATH"; exit 1; }
npm run check:links || echo "Warning: Link check failed"
npm run fix:format
cd .. || { echo "Error: Failed to change to parent directory"; exit 1; }

# Get version info
VERSION=$(ls -1 ecosystem-registry/collector/core | grep -v -i 'SNAPSHOT' | sort -V | tail -n 1)
if [ -z "$VERSION" ]; then
  echo "Error: No collector versions found in ecosystem-registry/collector/core"
  exit 1
fi
echo "Version: $VERSION"
echo ""

if [ -f "metadata-issues.md" ]; then
  echo "Reporting metadata quality issues for version ${VERSION}..."

  ISSUE_NUMBER=$(gh issue list \
    --repo "$GITHUB_REPOSITORY" \
    --label "metadata-quality" \
    --state open \
    --search "Collector ${VERSION} Metadata Quality Issues in:title" \
    --json number \
    --jq '.[0].number')

  ISSUE_TITLE="Collector ${VERSION} Metadata Quality Issues"

  if [ -n "$ISSUE_NUMBER" ]; then
    echo "Found existing issue #${ISSUE_NUMBER} for version ${VERSION}, updating..."
    UPDATED_BODY="## Metadata Quality Report for Collector ${VERSION}

$(cat metadata-issues.md)

---
_Last updated: $(date -u '+%Y-%m-%d %H:%M:%S UTC')_"

    gh issue edit "$ISSUE_NUMBER" \
      --repo "$GITHUB_REPOSITORY" \
      --body "$UPDATED_BODY"
  else
    echo "No existing issue found for version ${VERSION}, creating new issue..."
    gh issue create \
      --repo "$GITHUB_REPOSITORY" \
      --title "$ISSUE_TITLE" \
      --label "metadata-quality" \
      --body "$(cat metadata-issues.md)"
  fi
else
  echo "No metadata issues file found, skipping issue reporting"
fi

echo "Checking for documentation changes..."
cd "$OTEL_DOCS_REPO_PATH" || { echo "Error: Failed to change to directory $OTEL_DOCS_REPO_PATH"; exit 1; }
CHANGED_FILES=$(git diff --name-only content/en/docs/collector/components/)

if [ -z "$CHANGED_FILES" ]; then
  echo "No documentation changes detected"
  exit 0
fi

echo "Documentation changes detected:"
echo "$CHANGED_FILES"
echo ""
BRANCH_NAME="collector-docs-${VERSION//\./-}"

echo "Branch: $BRANCH_NAME"
echo ""

echo "Creating branch and committing changes..."
cd "$OTEL_DOCS_REPO_PATH" || { echo "Error: Failed to change to directory $OTEL_DOCS_REPO_PATH"; exit 1; }
git checkout main
git checkout -B "$BRANCH_NAME"
git add .

if git diff --staged --quiet; then
  echo "No changes to commit"
  exit 0
fi

git commit -m "Update Collector component tables"
echo "Changes committed"
echo ""

echo "============================================================================"
echo "PR WORKFLOW: Push branch to fork, then create PR to target repo"
echo "============================================================================"
echo ""
echo "PR Plan:"
echo "  • Push branch to:    ${SOURCE_FORK}/opentelemetry.io"
echo "  • Create PR against: ${DESTINATION_REPO}/opentelemetry.io"
echo ""

# Validate we're not trying to push directly to upstream
if [ "${SOURCE_FORK}" = "open-telemetry" ]; then
  echo "Error: Cannot push directly to open-telemetry/opentelemetry.io"
  echo "   SOURCE_FORK must be a personal/bot fork, not the upstream repo"
  exit 1
fi

# Set up remote and push
git remote remove source-fork 2>/dev/null || true
git remote add source-fork "https://x-access-token:${GH_TOKEN}@github.com/${SOURCE_FORK}/opentelemetry.io.git"
git push -f source-fork "$BRANCH_NAME"

echo "Pushed branch '${BRANCH_NAME}' to ${SOURCE_FORK}/opentelemetry.io"

# Determine PR head reference format
# GitHub requires different formats:
#   - Same-repo PR:  "branch-name"
#   - Cross-repo PR: "owner:branch-name"
if [ "${SOURCE_FORK}" = "${DESTINATION_REPO}" ]; then
  PR_HEAD="${BRANCH_NAME}"
  echo "Creating same-repo PR (testing mode)"
else
  PR_HEAD="${SOURCE_FORK}:${BRANCH_NAME}"
  echo "Creating cross-repo PR (normal mode)"
fi

# Create or update PR
PR_BODY="## Update Collector Component Documentation

This PR updates the OpenTelemetry Collector component tables for version **${VERSION}**.

---

🤖 _This PR was automatically generated by the [ecosystem-explorer](https://github.com/${GITHUB_REPOSITORY})_"

gh pr create \
  --repo "${DESTINATION_REPO}/opentelemetry.io" \
  --head "${PR_HEAD}" \
  --title "Update Collector component tables for ${VERSION}" \
  --body "$PR_BODY" \
  2>&1 | tee pr-output.txt || {
    if grep -q "already exists" pr-output.txt; then
      echo "PR already exists, updating..."
      PR_NUMBER="$(gh pr list \
        --repo "${DESTINATION_REPO}/opentelemetry.io" \
        --head "${PR_HEAD}" \
        --state open \
        --json number \
        --jq '.[0].number')"
      if [ -z "$PR_NUMBER" ]; then
        echo "Failed to find existing PR for head ${PR_HEAD}"
        cat pr-output.txt
        exit 1
      fi
      gh pr edit "$PR_NUMBER" \
        --repo "${DESTINATION_REPO}/opentelemetry.io" \
        --title "Update Collector component tables for ${VERSION}" \
        --body "$PR_BODY"
    else
      echo "Failed to create PR"
      cat pr-output.txt
      exit 1
    fi
  }

echo ""
echo "Successfully created/updated PR"