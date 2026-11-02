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

"""Tests for the shared retrying HTTP session."""

from watcher_common.http import RETRY_STATUSES, build_session


def test_build_session_retries_transient_statuses():
    session = build_session()
    for prefix in ("https://", "http://"):
        retry = session.get_adapter(f"{prefix}example.com").max_retries
        assert retry.total == 3
        assert retry.backoff_factor == 1
        assert set(retry.status_forcelist) == set(RETRY_STATUSES)
        assert "POST" not in retry.allowed_methods
    assert "Authorization" not in session.headers


def test_build_session_sets_bearer_token():
    assert build_session("abc").headers["Authorization"] == "Bearer abc"
