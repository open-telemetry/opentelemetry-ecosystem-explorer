# Copyright The OpenTelemetry Authors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
"""Script to add copyright headers to Python and JS files that are missing them."""

import os

PY_HEADER = """\
# Copyright The OpenTelemetry Authors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
"""

JS_HEADER = """\
// Copyright The OpenTelemetry Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
"""

EXCLUDE_DIRS = {".git", "node_modules", "__pycache__", ".venv", "dist", "build"}


def get_header(filename: str) -> str | None:
    """Return the appropriate copyright header for the given file."""
    if filename.endswith(".py"):
        return PY_HEADER
    if filename.endswith(".js") or filename.endswith(".ts") or filename.endswith(".tsx"):
        return JS_HEADER
    return None


def add_header_to_file(filepath: str, header: str) -> None:
    """Prepend the copyright header to the file if it is missing."""
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    # skip if already has copyright
    if header.splitlines()[0] in content.splitlines()[:2]:
        return

    # handlling shebang
    if content.startswith("#!"):
        shebang, rest = content.split("\n", 1)
        new_content = shebang + "\n" + header + rest
    else:
        new_content = header + content

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(new_content)
    print(f"✅ Added header: {filepath}")


def main() -> None:
    for root, dirs, files in os.walk("."):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        for file in files:
            header = get_header(file)
            if header is None:
                continue
            add_header_to_file(os.path.join(root, file), header)


if __name__ == "__main__":
    main()
