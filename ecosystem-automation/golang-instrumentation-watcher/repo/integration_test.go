//go:build integration

// Package repo integration tests hit the network. Run them explicitly with a
// timeout, e.g.:
//
//	go test -tags integration -timeout 120s -run TestLive ./repo/
package repo

import (
	"strings"
	"testing"

	"golang.org/x/mod/semver"
)

// TestLiveLatestReleaseTag resolves the real go-contrib latest release tag over
// git (no GitHub API), verifying the ls-remote path is not rate-limited.
func TestLiveLatestReleaseTag(t *testing.T) {
	requireGit(t)

	tag, err := LatestReleaseTag()
	if err != nil {
		t.Fatalf("LatestReleaseTag() error = %v", err)
	}
	if !semver.IsValid(tag) || strings.Contains(tag, "/") || semver.Prerelease(tag) != "" {
		t.Errorf("LatestReleaseTag() = %q, want a bare release version like v1.44.0", tag)
	}
	if semver.Major(tag) != "v1" {
		t.Errorf("LatestReleaseTag() major = %q, want v1 (go-contrib stable line)", semver.Major(tag))
	}
	t.Logf("resolved latest go-contrib release tag: %s", tag)
}
