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

"""Track browser SDK releases separately from instrumentation releases."""

import json

from .browser_sync import BrowserSync


class BrowserSdkSync(BrowserSync):
    """Reuse release backfill while keeping SDK exports out of instrumentation modules."""

    tag_prefix = "browser-sdk-v"
    package_name = "browser-sdk"

    def parse(self, version: str) -> dict:
        ref = f"refs/tags/{self.tag_prefix}{version}"
        content = self.detector.read_file_at_ref(ref, "packages/sdk/package.json")
        if content is None:
            raise ValueError(f"Missing SDK package.json at {ref}")
        package = json.loads(content)
        if package.get("name") != "@opentelemetry/browser-sdk" or package.get("version") != version:
            raise ValueError(f"SDK package name/version does not match {ref}")
        entry = {
            "name": self.package_name,
            "npm_package": "@opentelemetry/browser-sdk",
            "version": version,
            "repository": "open-telemetry/opentelemetry-browser",
            "source_path": "packages/sdk",
            "package_type": "sdk",
        }
        if package.get("description"):
            entry["description"] = package["description"]
        keywords = package.get("keywords")
        if isinstance(keywords, list) and "web" in keywords:
            entry["platform"] = "browser"
        return entry
