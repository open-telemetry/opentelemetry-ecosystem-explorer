#!/usr/bin/env bash
# Independent re-implementation of explorer_db_builder.archive_writer.tree_digest.
#
# Deliberately not a call into the builder: the contract gate exists to catch a bug in the Python,
# and a checker that shares the implementation would agree with itself. `-r` matters because GNU
# xargs runs its command once even with no input, which would digest an empty tree to the wrong
# value. `--` matters because GNU getopt permutes: a file whose name starts with a dash would
# otherwise be parsed as an option and abort the run.
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "usage: $0 <directory>" >&2
  exit 2
fi

cd "$1"
find . -type f -printf '%P\0' | LC_ALL=C sort -z | xargs -0 -r sha256sum -- | sha256sum | cut -d' ' -f1
