package instrumentation

import (
	"path/filepath"

	"github.com/open-telemetry/opentelemetry-ecosystem-explorer/golang-instrumentation-watcher/metadata"
	"github.com/open-telemetry/opentelemetry-ecosystem-explorer/golang-instrumentation-watcher/repo"
)

// Library is the fused per-instrumentation record: derived library metadata
// combined with telemetry extracted from static analysis. It mirrors the
// libraries[].telemetry[] shape used by the other ecosystem watchers.
type Library struct {
	metadata.Metadata `yaml:",inline"`
	Telemetry         []Telemetry `yaml:"telemetry,omitempty"`
}

// ScanResult holds the two outputs of a repository scan: the fused library
// records (for the versioned inventory) and the deduplicated Weaver groups
// (for the registry).
type ScanResult struct {
	Libraries []Library
	Groups    []Group
}

// ScanRepo walks an upstream repository and produces both the fused library
// records and the deduplicated Weaver groups in a single pass.
func ScanRepo(repoName, repoPath string) (*ScanResult, error) {
	var scanPaths []string
	switch repoName {
	case repo.RepoGo:
		scanPaths = []string{repoPath}
	default:
		scanPaths = []string{filepath.Join(repoPath, "instrumentation")}
	}

	var libraries []Library
	groupMap := make(map[string]*Group)
	for _, scanPath := range scanPaths {
		packages, err := Walk(scanPath)
		if err != nil {
			continue
		}
		for _, pkg := range packages {
			lib, groups, err := analyzeLibrary(pkg.GoModPath)
			if err != nil || lib == nil {
				continue
			}
			libraries = append(libraries, *lib)
			for _, group := range groups {
				mergeGroup(groupMap, group)
			}
		}
	}

	groups := make([]Group, 0, len(groupMap))
	for _, group := range groupMap {
		groups = append(groups, *group)
	}

	return &ScanResult{Libraries: libraries, Groups: groups}, nil
}

// analyzeLibrary builds the fused record for a single instrumentation module.
// Metadata is derived from the module's own go.mod directive; telemetry and
// Weaver groups come from static analysis of the package.
func analyzeLibrary(goModPath string) (*Library, []Group, error) {
	mod, err := ParseModule(goModPath)
	if err != nil {
		return nil, nil, err
	}
	if mod.Path == "" || !IsOTelContribRequire(mod.Path) {
		return nil, nil, nil
	}

	meta := DeriveMetadata(mod)

	analysis, err := AnalyzePackage(filepath.Dir(goModPath))
	if err != nil {
		return nil, nil, err
	}

	var telemetry []Telemetry
	var groups []Group
	if analysis != nil {
		if len(analysis.SemanticConventions) > 0 {
			meta.SemanticConventions = analysis.SemanticConventions
		}
		telemetry = analysis.Telemetry
		groups = analysis.Groups
	}

	return &Library{Metadata: *meta, Telemetry: telemetry}, groups, nil
}

// mergeGroup adds a group to the map, unioning attributes by ref when the
// group ID already exists.
func mergeGroup(groupMap map[string]*Group, group Group) {
	existing, ok := groupMap[group.ID]
	if !ok {
		groupCopy := group
		groupMap[group.ID] = &groupCopy
		return
	}

	attrSeen := make(map[string]bool, len(existing.Attributes))
	for _, attr := range existing.Attributes {
		attrSeen[attr.Ref] = true
	}
	for _, attr := range group.Attributes {
		if !attrSeen[attr.Ref] {
			existing.Attributes = append(existing.Attributes, attr)
			attrSeen[attr.Ref] = true
		}
	}
}
