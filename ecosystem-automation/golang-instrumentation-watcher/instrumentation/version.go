package instrumentation

import "strings"

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
// per-module map produced by [ModuleVersions], keyed by the module's
// repo-relative path. Libraries without a matching entry are left unchanged.
func ApplyModuleVersions(libs []Library, versions map[string]string) {
	for i := range libs {
		for j := range libs[i].Modules {
			modPath := libs[i].Modules[j].Path
			for prefix, v := range versions {
				if modPath == prefix || strings.HasSuffix(modPath, "/"+prefix) {
					libs[i].Modules[j].Version = v
					break
				}
			}
		}
	}
}
