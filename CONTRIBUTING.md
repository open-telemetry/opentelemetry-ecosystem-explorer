# Contributing to OpenTelemetry Ecosystem Explorer

Welcome to the OpenTelemetry Ecosystem Explorer! Whether you're fixing a typo, reporting a bug, or
proposing a new feature, every contribution helps.

This project helps users discover and explore OpenTelemetry projects, instrumentations, and
components across the [OpenTelemetry](https://opentelemetry.io/) ecosystem.

**No contribution is too small!** We value all forms of participation, from documentation
improvements to code contributions. If you're new to open source or OpenTelemetry, don't hesitate to
ask questions.

## Quick Start

```bash
git clone https://github.com/YOUR_USERNAME/opentelemetry-ecosystem-explorer.git
cd opentelemetry-ecosystem-explorer
uv sync --all-groups && bun install
cd ecosystem-explorer && bun install && bun run serve
# Visit http://localhost:5173
```

Now you can browse Java Agent instrumentations and Collector components locally. Continue reading
for detailed setup and contribution guidelines.

## Contributing Rules

### Contribution Workflow

For most changes, we follow an **issue-first workflow**. This keeps effort aligned with project
goals and prevents duplicated or wasted work. Please read this section before writing any code.

1. **Find or open an issue.** Every change should be tracked by an issue — including bug fixes and
   smaller improvements. For anything beyond a trivial typo, do not open a pull request without a
   corresponding issue.
2. **Discuss before you build.** Describe the problem, the use case, and your proposed approach,
   then wait for a maintainer to weigh in. This is your opportunity to confirm the change is wanted
   and to agree on an approach _before_ investing time in it.
3. **Wait for the `contribution welcome` label.** A maintainer applies this label once an issue has
   been triaged and is ready to be worked on. **Do not start work, and do not open a pull request,
   until the issue you are addressing has this label.** PRs that skip this step may be closed and
   asked to go through the process.
4. **Get assigned.** Once an issue has the `contribution welcome` label and you would like to take
   it on, leave a comment asking to be assigned and wait for a maintainer to assign it to you before
   starting.

Opening an issue and immediately filing a PR for it does **not** satisfy this process. The point is
to get maintainer input before code is written, not after.

### AI Usage

AI tools can be used to assist with code generation, documentation, and other tasks related to this
project. However, all contributions must be reviewed and tested by a human before submission. **You
are responsible for everything you submit.** If you cannot explain how your change works and why it
is correct, it is not ready for a pull request — do not open PRs containing code you do not
understand.

Use AI as an assistant, not an author:

- **Review and edit AI output.** Do not paste unreviewed, AI-generated text into issues or PR
  descriptions. Long, generic, or boilerplate descriptions are a red flag, and make the review
  harder.
- **Keep descriptions accurate and concise.** An issue or PR description must reflect what the
  change actually does. We would much rather read three honest sentences than three screens of
  generated prose that we then have to reconcile against the diff.

When working on UI elements, ensure that your agents reference the `ecosystem-explorer/DESIGN.md`
document for detailed guidelines to help ensure consistency and quality across the project.

For more details, read our
[Generative AI contribution policy](https://github.com/open-telemetry/community/blob/main/policies/genai.md).

### Code Standards

- **Follow the style guide**: Install pre-commit hooks to catch issues before committing
- **Write tests**: Include tests and testing notes in PR descriptions (screenshots appreciated)
- **Document your code**: Add docstrings and comments for non-obvious logic
- **Keep changes focused**: One concern per PR
- **Understand your changes**: Be ready to explain and defend every line you submit during review
- **Write clear, accurate PR descriptions**: Explain the motivation, approach, and context in your
  own words, and link the issue your PR resolves. Keep it concise and make sure it matches the
  actual change

### Community Standards

This project follows the
[OpenTelemetry Community Code of Conduct](https://github.com/open-telemetry/community/blob/main/code-of-conduct.md).
By participating, you agree to uphold this code.

### Contributor License Agreement (CLA)

All contributors must sign the [OpenTelemetry CLA](https://docs.linuxfoundation.org/lfx/easycla).
The CLA bot will comment on your PR if you haven't signed it yet. This is a one-time process.

## Finding Issues to Work On

Look for issues tagged with:

- [`good first issue`](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/labels/good%20first%20issue)
  \- Great for newcomers
- [`help wanted`](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/labels/help%20wanted) -
  Community contributions welcome
- [`documentation`](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/labels/documentation) -
  Documentation improvements

Remember that an issue is only ready to be worked on once it has the `contribution welcome` label.
See [Contribution Workflow](#contribution-workflow) for the full process.

### Claiming an Issue

Before asking to work on an issue:

- **Check whether it is already assigned.** An assigned issue is already being worked on — find
  another one rather than commenting to ask for it.
- **Read the existing comments.** If another contributor has already asked for the issue or said
  they are working on it, treat it as claimed even if assignment is still pending. Please don't add
  a duplicate "can I work on this?" comment.
- **Confirm the `contribution welcome` label is present** before requesting assignment.

If an assigned issue has been inactive for a long time and you would like to pick it up, leave a
polite comment asking about its status rather than starting work in parallel.

## Mapping The Ecosystem

Building the registry, automation pipelines, and Explorer interface is only part of the work. Before
systems can be automated, the terrain must first be mapped.

Each project within the ecosystem represents its own landscape with distinct components, structures,
and conventions. Our task is to survey these landscapes and determine:

- What components exist?
- What metadata is available?
- Is that metadata structured in a way that can be incorporated into the registry?
- Where are the gaps?

In many cases, this requires careful exploration like reading source code, locating configuration
files, identifying implicit conventions, and translating them into structured, registry-ready data.
Even existing data should be regularly reviewed and iterated upon.

If you are interested in a particular language, auto-instrumentation tool, or corner of the
ecosystem, we would love your help.

Choose an area that interests you and begin the survey. Trace the components, locate data, identify
patterns, and document what you find. If something is unclear or incomplete, open an issue or start
a discussion, expedition logs are part of the process. We can help validate findings, refine
translation strategies, and support integration into the registry.

This work is valuable for both newcomers and seasoned contributors. For those new to the community,
it provides a structured way to understand how projects are organized, how metadata is shaped, and
how automation connects systems together. For experienced contributors, it offers a broader,
cross-ecosystem perspective, revealing patterns, inconsistencies, and opportunities for improvement
that are often invisible when focused on a single project.

Whether you are surveying your first repository or helping refine automation across dozens, every
mapped component strengthens the atlas.

## Pre-requisites

Before you begin contributing, ensure you have the following tools installed:

### Required Tools

- **Python 3.11 or higher**: The project is built with Python and requires version 3.11+
  - Check your version: `python --version` or `python3 --version`
  - Download from [python.org](https://www.python.org/downloads/)

- **uv**: Fast Python package installer and resolver
  - Install with: `pip install uv` or follow
    [uv installation guide](https://github.com/astral-sh/uv)

- **Bun**: JavaScript runtime and package manager (used for ecosystem-explorer and markdown linting)
  - Check your version: `bun --version`
  - Install from [bun.sh](https://bun.sh/)

- **Git**: Version control system (used in some of the automation scripts)
  - Check your version: `git --version`
  - Download from [git-scm.com](https://git-scm.com/)

### Optional but Recommended

- **pre-commit**: Git hook framework for running checks before commits
  - Installed automatically with development dependencies
  - Helps catch issues before they're committed

## Getting Started

### Fork and Clone the Repository

```bash
# Fork the repository on GitHub first, then clone your fork
git clone https://github.com/YOUR_USERNAME/opentelemetry-ecosystem-explorer.git
cd opentelemetry-ecosystem-explorer
```

### Install Dependencies

```bash
# Install Python dependencies using uv
uv sync --all-groups

# Install JavaScript dependencies for markdown linting (from repo root)
bun install

# Install ecosystem-explorer dependencies
cd ecosystem-explorer && bun install && cd ..

# Set up pre-commit hooks (recommended)
uv run pre-commit install
```

### Create a Branch

Before making changes, create a new branch:

```bash
git checkout -b your-feature-branch
```

## Local Development

### Project Structure

This repository contains three components:

- **ecosystem-registry**: Raw data registry
- **ecosystem-automation**: Automation pipelines
- **ecosystem-explorer**: Web application

Reference implementations: [collector-watcher](https://github.com/jaydeluca/collector-watcher),
[instrumentation-explorer](https://github.com/jaydeluca/instrumentation-explorer)

### Running Code Quality Checks

Before committing changes, run these checks to ensure your code will pass our CI pipeline:

```bash
# Run all linting (Markdown, ESLint, Ruff)
bun run lint

# Run all formatting (Prettier, Ruff)
bun run format
uv run ruff format .

# Run markdown linting specifically
bun run lint:md

# Fix issues automatically
bun run format
bun run lint:md:fix
uv run ruff check . --fix

# Add copyright headers to new files
uv run python scripts/add_copyright.py

# Check copyright headers
uv run python scripts/check_copyright.py
```

If you installed pre-commit hooks, these checks will run automatically when you commit.

## Testing

The Python modules in this project use [pytest](https://docs.pytest.org/) for testing.

### Running Tests

```bash
# Run all tests
uv run pytest

# Run tests with coverage report
uv run pytest --cov

# Run tests for a specific component
cd ecosystem-automation/collector-watcher
uv run pytest tests/ -v

# Run a specific test file
uv run pytest tests/test_specific.py

# Run tests matching a pattern
uv run pytest -k "test_pattern"
```

### Test Organization

#### Python Tests

- Test files follow the naming convention: `test_*.py` or `*_test.py`
- Tests are located in `ecosystem-automation/` subdirectories
- Each component has its own test suite

#### JavaScript Tests

- Test files follow the naming convention: `*.test.tsx` or `*.test.ts`
- Tests are located alongside the components they test in the `src/` directory
- Test setup file at `src/test/setup.ts` imports jest-dom matchers

## PR Screenshots

When working on UI changes, you can automatically generate screenshots of key Explorer pages to
include in your PR for visual review.

### Automatic Screenshots via GitHub Actions

Add the `add-screenshots` label to your PR. A GitHub Actions workflow will:

1. Build the frontend
2. Launch a local server and use Playwright to capture screenshots of key pages (home,
   instrumentation list, instrumentation detail tabs, collector list, and collector detail) at
   desktop, tablet, and mobile viewports
3. Commit the screenshots to the `otelbot/screenshots` branch and post them as an inline PR comment

The workflow re-runs automatically on new commits while the label is present.

### Local Screenshots

You can also generate screenshots locally:

```bash
cd ecosystem-explorer
bun install
bun run build
bunx playwright install --with-deps chromium
node scripts/take-screenshots.mjs
# Screenshots are saved to ecosystem-explorer/screenshots/
```

## Further Help

### Community Resources

- **Slack**: Join the
  [#otel-ecosystem-explorer](https://cloud-native.slack.com/archives/C09N6DDGSPQ) channel on CNCF
  Slack ([get invite](https://communityinviter.com/apps/cloud-native/cncf))
- **OpenTelemetry Community**: [Community repo](https://github.com/open-telemetry/community) with
  governance and contributing guides
- **Project Proposal**:
  [Ecosystem Explorer Proposal](https://github.com/open-telemetry/community/blob/main/projects/ecosystem-explorer.md)
