#!/usr/bin/env bash
# Replace the three generated directories with the contents of their archives.
#
# The directories are emptied first: unpacking over the existing tree would hide files the archive
# omits, which is the failure that matters.
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "usage: $0 <archive-directory>" >&2
  exit 2
fi

archives="$1"

# Validate every archive before deleting anything. Without this the script removes all three
# directories and only then discovers that an archive is missing or corrupt, which destroys the
# tree it was asked to replace.
for eco in collector configuration javaagent; do
  if [ ! -f "$archives/$eco.tar.gz" ]; then
    echo "$0: missing archive $archives/$eco.tar.gz" >&2
    exit 1
  fi
  if ! tar -tzf "$archives/$eco.tar.gz" >/dev/null 2>&1; then
    echo "$0: $archives/$eco.tar.gz is not a readable gzip archive" >&2
    exit 1
  fi
done

for eco in collector configuration javaagent; do
  target="ecosystem-explorer/public/data/$eco"
  rm -rf "$target"
  mkdir -p "$target"
  tar -xzf "$archives/$eco.tar.gz" -C "$target"
done
