# Copyright The OpenTelemetry Authors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

"""Entry point: ``run`` discovers and extracts, ``review`` upserts issues, ``check`` validates files."""

import argparse
import logging
import os
import sys
from pathlib import Path

from . import pipeline, review
from .accepted import TIMELINE_PATH, AcceptedHistory, load_accepted
from .github_client import GitHubClient
from .gitrepo import REF_RE, GitRepo
from .repositories import HEAD_REF, SOURCES, SemconvRepositoryManager
from .state import REGISTRY_DIR, Store, check_record
from .validation import InvalidFileError

logger = logging.getLogger(__name__)


def _ref(value: str) -> str:
    if not REF_RE.match(value):
        raise argparse.ArgumentTypeError(f"invalid ref: {value!r}")
    return value


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="semconv-timeline-watcher", description=__doc__)
    parser.add_argument("--registry-dir", type=Path, default=REGISTRY_DIR, help="candidate and state directory")
    parser.add_argument("--timeline", type=Path, default=TIMELINE_PATH, help="accepted history (read only)")
    commands = parser.add_subparsers(dest="command", required=True)

    run = commands.add_parser("run", help="discover, extract and store candidates")
    run.add_argument("--source", action="append", choices=sorted(SOURCES), help="limit to a source; repeatable")
    run.add_argument("--tag", type=_ref, help="replay one published core release")
    run.add_argument(
        "--from", dest="from_ref", type=_ref, help="replay or backfill an explicit range, start (exclusive)"
    )
    run.add_argument("--to", dest="to_ref", type=_ref, help="explicit range end (inclusive)")
    run.add_argument("--force", action="store_true", help="re-extract unchanged revisions")
    run.add_argument("--repos-dir", default=None, help="where clones live (default tmp_repos)")

    for name, text in (
        ("review", "create or update maintainer review issues"),
        ("check", "validate state and dispositions against accepted history"),
    ):
        sub = commands.add_parser(name, help=text)
        sub.add_argument("--source", action="append", choices=sorted(SOURCES), help="limit to a source; repeatable")
    return parser


def _validate_run_args(args: argparse.Namespace, parser: argparse.ArgumentParser) -> list[str]:
    sources = args.source or sorted(SOURCES)
    manual = args.tag or args.from_ref or args.to_ref
    if manual and len(sources) != 1:
        parser.error("--tag/--from/--to replay a single source: pass exactly one --source")
    if args.to_ref and not args.from_ref:
        parser.error("--to requires --from")
    if args.tag and (args.from_ref or sources != [pipeline.CORE]):
        parser.error("--tag replays one core release and cannot be combined with --from")
    if args.from_ref and sources == [pipeline.CORE] and not args.to_ref:
        parser.error("a core range needs both --from and --to")
    return sources


def store_for(args: argparse.Namespace, source: str) -> Store:
    """Each source owns its own directory, so its state and pull request never conflict with the other's."""
    return Store(args.registry_dir / source)


def run_command(
    args: argparse.Namespace,
    sources: list[str],
    accepted: AcceptedHistory,
    client=None,
    repos: dict[str, GitRepo] | None = None,
    head_ref: str = HEAD_REF,
) -> int:
    opts = {"tag": args.tag, "from_ref": args.from_ref, "to_ref": args.to_ref, "force": args.force}
    failures: list[str] = []
    for source in sources:
        store = store_for(args, source)
        try:
            store.recover()
            state = store.load_state()
            repo = (repos or {}).get(source) or GitRepo(SemconvRepositoryManager(source, args.repos_dir).setup())
            current = state["sources"].get(source, pipeline.empty_source_state())
            if source == pipeline.CORE:
                client = client or GitHubClient(os.environ.get("GITHUB_TOKEN"))
                updated, report = pipeline.process_core(store, accepted, repo, client, current, opts)
            else:
                updated, report = pipeline.process_genai(store, accepted, repo, current, opts, head_ref)
            state["sources"][source] = updated
            store.save_state(state)  # last, so every record it references already exists
            logger.info("%s: %s", source, report)
            # A failed revision does not stop the run (its state is saved for the review step to raise an
            # issue), but it must never go unnoticed in the log.
            for key, revision in updated["revisions"].items():
                if revision["status"] == "failed":
                    logger.error("Revision %s failed: %s", key, revision.get("error") or revision.get("invalid"))
        except Exception as e:  # noqa: BLE001 - isolate the source; the other still runs
            logger.exception("Source %s failed; its previous state is retained", source)
            failures.append(f"{source}: {e}")
    for line in failures:
        print(f"FAILED {line}", file=sys.stderr)
    return 1 if failures else 0


def _selected(args: argparse.Namespace) -> list[str]:
    return args.source or sorted(SOURCES)


def _load(store: Store, label: str, problems: list[str]) -> dict | None:
    """The source's state, or None after recording why it is unusable; never raises on bad files."""
    try:
        return store.load_state()
    except (InvalidFileError, ValueError) as e:
        problems.append(f"{label}: {e}")
        return None


def check_command(args: argparse.Namespace, accepted: AcceptedHistory) -> int:
    """Everything a maintainer or CI must act on: bad files, bad dispositions, failures, moved tags."""
    problems: list[str] = []
    for source in _selected(args):
        store = store_for(args, source)
        state = _load(store, f"{source}/state.json", problems)
        for src in (state or {"sources": {}})["sources"].values():
            for key, revision in src["revisions"].items():
                if revision.get("error") or revision.get("invalid"):
                    problems.append(f"{key}: failed: {revision.get('error') or revision.get('invalid')}")
                if revision.get("tagChanged"):
                    change = revision["tagChanged"]
                    problems.append(f"{key}: tag moved from {change['previous']} to {change['current']}; reconcile it")
                try:
                    record = store.read_record(source, key)
                except InvalidFileError as e:
                    problems.append(str(e))
                    continue
                if record is None:
                    problems.append(f"{key}: candidate file is missing")
                else:
                    problems += check_record(record, accepted)
            problems += [
                f"{source}: accepted tag {r['key']} now resolves to {r['actual']}, not {r['expected']}"
                for r in src["reconcile"]
            ]
    for line in problems:
        print(line, file=sys.stderr)
    return 1 if problems else 0


def review_command(args: argparse.Namespace, accepted: AcceptedHistory, client=None) -> int:
    repo = os.environ.get("GITHUB_REPOSITORY")
    if not repo:
        print("GITHUB_REPOSITORY is required", file=sys.stderr)
        return 1
    client = client or GitHubClient(os.environ.get("GITHUB_TOKEN"))
    problems: list[str] = []
    states = {}
    for source in sorted(SOURCES):  # every source is read so a move can describe its destination
        state = _load(store_for(args, source), f"{source}/state.json", problems if source in _selected(args) else [])
        src = state["sources"].get(source) if state else None
        if src:
            states[source] = pipeline.refresh_statuses(store_for(args, source), accepted, src)
    coverage = {s: review.source_coverage(accepted, s, st) for s, st in states.items() if st}
    items = []
    for source in _selected(args):
        src = states.get(source)
        if not src:
            continue
        store = store_for(args, source)
        for key, revision in src["revisions"].items():
            try:
                record = store.read_record(source, key)
            except InvalidFileError:
                record = None  # refresh_statuses already marked the revision invalid
            items.append(
                {
                    "kind": "revision",
                    "key": key,
                    "source": source,
                    "record": record,
                    "status": revision["status"],
                    "state": revision,
                    "coverage": coverage,
                }
            )
        items += [{"kind": "reconcile", "key": r["key"], "source": source, "entry": r} for r in src["reconcile"]]
    actions = review.upsert_reviews(client, repo, items, accepted)
    for key, action in actions:
        print(f"{key}: {action}", file=sys.stderr if action.startswith("failed") else sys.stdout)
    for line in problems:
        print(line, file=sys.stderr)
    # A failed revision (extraction error or unusable file) still gets its issue above, but the run is not
    # clean: exit non-zero so the workflow notifies maintainers.
    failed_items = [i["key"] for i in items if i["kind"] == "revision" and i["status"] == "failed"]
    return 1 if problems or failed_items or any(a.startswith("failed") for _, a in actions) else 0


def main(argv: list[str] | None = None) -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    parser = build_parser()
    args = parser.parse_args(argv)
    command = args.command
    accepted = load_accepted(args.timeline)
    if command == "run":
        sys.exit(run_command(args, _validate_run_args(args, parser), accepted))
    if command == "review":
        sys.exit(review_command(args, accepted))
    sys.exit(check_command(args, accepted))
