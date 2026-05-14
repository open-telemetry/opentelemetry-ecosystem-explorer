# V1 Registry Sync

Dry-run tool for comparing V2 ecosystem-registry data against V1 entries under
`opentelemetry.io/data/registry/` and reporting which fields would change.

## Overview

The tool reads the latest release snapshot from `ecosystem-registry/collector/` and produces a
report of proposed changes. Each entry in the report includes:

- `target_v1_file`: the expected V1 filename for the component (e.g. `collector-kafkareceiver.yml`)
- `v1_entry_exists`: whether that file is present in the V1 registry directory (when `--v1-registry-dir` is provided)
- `proposed_v1_changes`: fields from V2 that would be written to the V1 entry

Only `description` is included in `proposed_v1_changes`. The V1 schema does not carry a `stability`
field, and `title` (mapped from `display_name`) is omitted because a small number of V1 titles
contain more information than the V2 display name and would lose fidelity on overwrite.

## Usage

From the repository root:

```bash
uv run v1-registry-sync
```

This reads `ecosystem-registry/collector/contrib/` by default and writes JSON to stdout.

### Options

```
--inventory-dir PATH   Path to ecosystem-registry/collector (default: ecosystem-registry/collector)
--distribution         core or contrib (default: contrib)
--v1-registry-dir PATH Path to opentelemetry.io data/registry/ — enables v1_entry_exists checks
--output PATH          Output file path, or - for stdout (default: -)
--format               json or yaml (default: json)
```

### Example with V1 registry check

```bash
uv run v1-registry-sync \
  --v1-registry-dir ../opentelemetry.io/data/registry \
  --format yaml \
  --output sync-report.yaml
```
