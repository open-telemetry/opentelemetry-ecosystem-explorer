# `.ai/` — AI tooling home

## Layout

```text
.ai/
├── skills/                        # reusable, tool-agnostic skills (runbooks + helper scripts)
│   └── <skill-name>/
│       ├── SKILL.md               # the skill: YAML frontmatter (name, description) + instructions
│       └── *.py, *.sh, ...        # optional helper scripts bundled with the skill
└── README.md
```

Each skill is a **directory** containing `SKILL.md` (not a flat `.md` file), so it can bundle helper
scripts and be discovered by assistants that expect the `<skill-name>/SKILL.md` convention.

## How Claude Code picks these up

Claude Code discovers project skills under `.claude/skills/`. We keep the source of truth in `.ai/`
and expose each skill with a **per-skill symlink that is committed to git**:

```text
.claude/skills/<name> -> ../../.ai/skills/<name>
```

We symlink individual skills (not the whole `.claude/skills` directory) so the committed skills
coexist with any personal, untracked skills a contributor keeps in their own `.claude/skills/`.

These symlinks are tracked (git mode `120000`), so git recreates them on every clone/checkout — the
skill "just works" with no manual setup. Note `.claude/` is otherwise git-excluded locally (see
`.git/info/exclude`), so the symlinks were added with `git add -f`; the rest of `.claude/` stays
untracked.

Caveat: on Windows the symlink is only recreated if git symlink support is on
(`git config core.symlinks true`, plus Developer Mode / admin). Otherwise it materializes as a small
text file and the skill won't resolve — recreate the link manually.

### Adding a new skill

```bash
# 1. author the skill under .ai/skills/
mkdir -p .ai/skills/<name> && $EDITOR .ai/skills/<name>/SKILL.md

# 2. link it into .claude/skills and commit the (tracked) symlink
mkdir -p .claude/skills
ln -s ../../.ai/skills/<name> .claude/skills/<name>
git add -f .claude/skills/<name>
```

## Current skills

- `skills/database-build-review/` — review the PR produced by the Build Explorer Database workflow
  (`.github/workflows/build-explorer-database.yml`): verify the generated diff is correct, triage
  content-hash churn, and decide whether a change needs a corrections overlay. Bundles
  `diff_build_pr.py`, which diffs the content-addressed database between a base ref and a PR/head ref.
