package instrumentation

import (
	"strings"

	"golang.org/x/mod/semver"

	"github.com/open-telemetry/opentelemetry-ecosystem-explorer/golang-instrumentation-watcher/metadata"
)

// ModuleVersions maps repo-relative module paths to their semantic version,
// derived from go-contrib's per-module git tags. For example the tag
// "instrumentation/net/http/otelhttp/v0.62.0" yields
// {"instrumentation/net/http/otelhttp": "v0.62.0"}. Bare repo-wide tags (no
// module path) are ignored.
func ModuleVersions(tags []string) map[string]string {
	versions := make(map[string]string)
	for _, tag := range tags {
		idx := strings.LastIndex(tag, "/v")
		if idx == -1 {
			continue
		}
		versions[tag[:idx]] = tag[idx+1:]
	}
	return versions
}

// ApplyModuleVersions sets each [Library]'s Module.Version from versions, the
// per-module map produced by [ModuleVersions]. The exact tag key is derived
// by locating the library's SourcePath within the full module path. Libraries
// without a matching entry are left unchanged.
// It also infers library stability if currently unspecified.
func ApplyModuleVersions(libs []Library, versions map[string]string) {
	for i := range libs {
		for j := range libs[i].Modules {
			modPath := libs[i].Modules[j].Path
			// Derive the tag key by locating SourcePath inside the full module
			// path. For go-contrib, SourcePath == tag key exactly. For
			// multi-module libraries (e.g. go-compile-instrumentation),
			// SourcePath is the parent directory and the module appends its own
			// sub-path (e.g. SourcePath="instrumentation/net/http",
			// modPath=".../instrumentation/net/http/client" ->
			// tagKey="instrumentation/net/http/client").
			// Note: strings.Index could mis-anchor if SourcePath appears as a
			// substring of a path component, but SourcePath is always a
			// multi-segment repo-relative directory so this is unlikely in practice.
			tagKey := libs[i].SourcePath
			if idx := strings.Index(modPath, libs[i].SourcePath); idx != -1 {
				tagKey = modPath[idx:]
			}
			if v, ok := versions[tagKey]; ok {
				libs[i].Modules[j].Version = v
			}
		}

		if libs[i].Stability == metadata.StabilityUnknown {
			stable := true
			for _, m := range libs[i].Modules {
				if m.Version == "" || semver.Compare(m.Version, "v1.0.0") < 0 {
					stable = false
					break
				}
			}
			if stable && len(libs[i].Modules) > 0 {
				libs[i].Stability = metadata.StabilityStable
			} else {
				libs[i].Stability = metadata.StabilityExperimental
			}
		}
	}
}
