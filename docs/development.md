# Development

## Setting Up Development Environment

Prerequisites:
* Install [uv](https://docs.astral.sh/uv/) for dependency management


### Install Dependencies
```bash
uv sync --all-extras --dev
```

### Install Pre-commit Hooks

The project uses pre-commit hooks to ensure code quality:

```bash
pre-commit install
```

This will automatically run linting and tests before each commit.

## Running Tests

### Run all tests

```bash
pytest ecosystem-automation/collector-watcher/tests/ -v
```

### Run with coverage

```bash
cd ecosystem-automation/collector-watcher
pytest tests/ --cov=collector_watcher --cov-report=term-missing
```

## Code Coverage Badge

The README includes a coverage badge that shows the current test coverage percentage.

### Update Coverage Badge Manually

```bash
./scripts/update_coverage_badge.sh
```

The coverage badge is automatically updated on pushes to main via GitHub Actions.

## Code Formatting and Linting

### Format code

```bash
ruff format .
```

### Check for linting issues

```bash
ruff check .
```

### Auto-fix linting issues

```bash
ruff check --fix .
```