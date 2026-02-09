# Contributing to OpenTelemetry Ecosystem Explorer

Welcome to the OpenTelemetry Ecosystem Explorer! Whether you're fixing a typo, reporting a bug, or proposing a new
feature, every contribution helps.

This project helps users discover and explore OpenTelemetry projects, instrumentations, and components across the
[OpenTelemetry](https://opentelemetry.io/) ecosystem.

**No contribution is too small!** We value all forms of participation, from documentation improvements to code
contributions. If you're new to open source or OpenTelemetry, don't hesitate to ask questions.

## Finding Issues to Work On

Look for issues tagged with:

- [`good first issue`](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/labels/good%20first%20issue)
  \- Great for newcomers
- [`help wanted`](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/labels/help%20wanted) - Community
  contributions welcome
- [`documentation`](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/labels/documentation) -
  Documentation improvements

## Mapping The Ecosystem

Building the registry, automation pipelines, and Explorer interface is only part of the work. Before systems can be
automated, the terrain must first be mapped.

Each project within the ecosystem represents its own landscape with distinct components, structures, and
conventions. Our task is to survey these landscapes and determine:

- What components exist?
- What metadata is available?
- Is that metadata structured in a way that can be incorporated into the registry?
- Where are the gaps?

In many cases, this requires careful exploration like reading source code, locating configuration files, identifying
implicit conventions, and translating them into structured, registry-ready data. Even existing data should be regularly
reviewed and iterated upon.

If you are interested in a particular language, auto-instrumentation tool, or corner of the ecosystem, we would love
your help.

Choose an area that interests you and begin the survey. Trace the components, locate data, identify patterns, and
document what you find. If something is unclear or incomplete, open an issue or start a discussion, expedition logs are
part of the process. We can help validate findings, refine translation strategies, and support integration into the
registry.

This work is valuable for both newcomers and seasoned contributors. For those new to the community, it provides a
structured way to understand how projects are organized, how metadata is shaped, and how automation connects systems
together. For experienced contributors, it offers a broader, cross-ecosystem perspective, revealing patterns,
inconsistencies, and opportunities for improvement that are often invisible when focused on a single project.

Whether you are surveying your first repository or helping refine automation across dozens, every mapped component
strengthens the atlas.

## Pre-requisites

Before you begin contributing, ensure you have the following tools installed:

### Required Tools

- **Python 3.11 or higher**: The project is built with Python and requires version 3.11+
  - Check your version: `python --version` or `python3 --version`
  - Download from [python.org](https://www.python.org/downloads/)

- **uv**: Fast Python package installer and resolver
  - Install with: `pip install uv` or follow [uv installation guide](https://github.com/astral-sh/uv)

- **Node.js 18.0.0 or higher**: Required for markdown linting
  - Check your version: `node --version`
  - Download from [nodejs.org](https://nodejs.org/)

- **npm**: Comes with Node.js, used for managing development dependencies
  - Check your version: `npm --version`

- **Git**: Version control system (used in some of the automation scripts)
  - Check your version: `git --version`
  - Download from [git-scm.com](https://git-scm.com/)

### Optional but Recommended

- **pre-commit**: Git hook framework for running checks before commits
  - Installed automatically with development dependencies
  - Helps catch issues before they're committed

## Getting Started

### 1. Fork and Clone the Repository

```bash
# Fork the repository on GitHub first, then clone your fork
git clone https://github.com/YOUR_USERNAME/opentelemetry-ecosystem-explorer.git
cd opentelemetry-ecosystem-explorer
```

### 2. Install Dependencies

```bash
# Install Python dependencies using uv
uv sync --all-groups

# Install Node.js dependencies for markdown linting
npm install

# Set up pre-commit hooks (recommended)
pre-commit install
```

### 3. Create a Branch

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

Reference
implementations: [collector-watcher](https://github.com/jaydeluca/collector-watcher),
[instrumentation-explorer](https://github.com/jaydeluca/instrumentation-explorer)

### Running Code Quality Checks

Before committing changes, run these checks to ensure your code will pass our CI pipeline:

```bash
# Run Python linting and formatting with ruff
uv run ruff check .
uv run ruff format .

# Run markdown linting
npm run lint:md

# Fix markdown issues automatically
npm run lint:md:fix
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

## Contributing Rules

### Code Standards

- **Follow the style guide**: Install pre-commit hooks to catch issues before committing
- **Write tests**: Include tests and testing notes in PR descriptions (screenshots appreciated)
- **Document your code**: Add docstrings and comments for non-obvious logic
- **Keep changes focused**: One concern per PR
- **Write detailed PR descriptions**: Explain motivation, approach, and context

### Community Standards

This project follows the
[OpenTelemetry Community Code of Conduct](https://github.com/open-telemetry/community/blob/main/code-of-conduct.md).
By participating, you agree to uphold this code.

### Contributor License Agreement (CLA)

All contributors must sign the [OpenTelemetry CLA](https://docs.linuxfoundation.org/lfx/easycla). The CLA bot will
comment on your PR if you haven't signed it yet. This is a one-time process.

### Feature Proposals

Before implementing significant new features:

1. [Open an issue](https://github.com/open-telemetry/opentelemetry-ecosystem-explorer/issues/new) to discuss your idea
2. Explain the use case and proposed approach
3. Get feedback from maintainers
4. Proceed with implementation once there's consensus

This helps avoid wasted effort on features that may not align with project goals.

## Further Help

### Community Resources

- **Slack**: Join the [#otel-ecosystem-explorer](https://cloud-native.slack.com/archives/C09N6DDGSPQ) channel on CNCF
  Slack
  ([get invite](https://communityinviter.com/apps/cloud-native/cncf))
- **OpenTelemetry Community**: [Community repo](https://github.com/open-telemetry/community) with governance and
  contributing guides
- **Project Proposal**:
  [Ecosystem Explorer Proposal](https://github.com/open-telemetry/community/blob/main/projects/ecosystem-explorer.md)
