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
"""Shared HTTP session setup for watchers that call remote APIs."""

import requests
from requests.adapters import HTTPAdapter
from urllib3 import Retry

RETRY_STATUSES = (429, 500, 502, 503, 504)


def build_session(token: str | None = None) -> requests.Session:
    """Return a session that retries transient failures with backoff.

    urllib3's default allowed methods are used, so a POST or PATCH that may have
    succeeded is never repeated.

    Args:
        token: Optional bearer token sent on every request
    """
    session = requests.Session()
    adapter = HTTPAdapter(max_retries=Retry(total=3, backoff_factor=1, status_forcelist=RETRY_STATUSES))
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    if token:
        session.headers.update({"Authorization": f"Bearer {token}"})
    return session
