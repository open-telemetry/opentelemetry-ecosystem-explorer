package inventory

import (
	"fmt"
	"sort"
	"strconv"
	"strings"

	"golang.org/x/mod/semver"
)

// IsValidVersion reports whether name is a valid semantic version directory
// name (with the leading "v", e.g. "v0.1.0" or "v0.2.0-SNAPSHOT").
func IsValidVersion(name string) bool {
	return semver.IsValid(name)
}

// IsSnapshot reports whether version is a snapshot (prerelease) version.
func IsSnapshot(version string) bool {
	return semver.Prerelease(version) != ""
}

// sortVersionsDesc sorts versions newest-to-oldest in place using semantic
// version ordering.
func sortVersionsDesc(versions []string) {
	sort.SliceStable(versions, func(i, j int) bool {
		return semver.Compare(versions[i], versions[j]) > 0
	})
}

// NextSnapshot returns the next snapshot version for the given latest release:
// the patch component is incremented and a "-SNAPSHOT" prerelease is attached
// (e.g. "v0.5.2" becomes "v0.5.3-SNAPSHOT"). It returns an error when
// latestRelease is not a valid semantic version. NextSnapshot mirrors the
// Python watcher's update_snapshot patch-bump behaviour.
func NextSnapshot(latestRelease string) (string, error) {
	core := semver.Canonical(latestRelease)
	if core == "" {
		return "", fmt.Errorf("invalid version: %q", latestRelease)
	}
	parts := strings.SplitN(strings.TrimPrefix(core, "v"), ".", 3)
	if len(parts) != 3 {
		return "", fmt.Errorf("invalid version: %q", latestRelease)
	}
	patch, err := strconv.Atoi(parts[2])
	if err != nil {
		return "", fmt.Errorf("invalid patch in version %q: %w", latestRelease, err)
	}
	return fmt.Sprintf("v%s.%s.%d-SNAPSHOT", parts[0], parts[1], patch+1), nil
}
