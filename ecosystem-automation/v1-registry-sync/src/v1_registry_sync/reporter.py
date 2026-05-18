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
"""Writes V1 sync reports to a stream in JSON or YAML format."""

import json
import sys
from typing import TextIO

import yaml as yaml_lib

from .models import V1SyncReport


def write_report(report: V1SyncReport, output: TextIO = sys.stdout, fmt: str = "json") -> None:
    """Serialize the sync report to the given output stream.

    Args:
        report: The V1SyncReport to serialize.
        output: The output stream to write to.
        fmt: Either 'json' or 'yaml'.
    """
    data = report.to_dict()
    if fmt == "yaml":
        yaml_lib.dump(data, output, default_flow_style=False, allow_unicode=True, sort_keys=False)
    else:
        json.dump(data, output, indent=2, ensure_ascii=False)
        output.write("\n")
