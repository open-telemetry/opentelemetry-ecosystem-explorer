package instrumentation

import (
	"cmp"
	"path/filepath"
	"slices"

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

// ScanResult holds the output of a repository scan: the fused library records
// for the versioned inventory.
type ScanResult struct {
	Libraries []Library
}

// ScanRepo walks an upstream repository and produces fused library records.
func ScanRepo(repoName, repoPath string) (*ScanResult, error) {
	var scanPaths []string
	switch repoName {
	case repo.RepoGo:
		scanPaths = []string{repoPath}
	default:
		// Only the subtrees that instrument a developer's code: instrumentation
		// wrappers (gin, grpc, http…) and bridges (zap, logrus…). The other
		// go-contrib components (exporters, propagators, samplers, detectors,
		// processors) configure the SDK pipeline rather than instrument a target
		// library, so they have no target_module and are out of scope here.
		for _, sub := range []string{"instrumentation", "bridges"} {
			scanPaths = append(scanPaths, filepath.Join(repoPath, sub))
		}
	}

	var libraries []Library
	for _, scanPath := range scanPaths {
		packages, err := Walk(scanPath)
		if err != nil {
			continue
		}
		for _, pkg := range packages {
			lib, err := analyzeLibrary(pkg.GoModPath)
			if err != nil || lib == nil {
				continue
			}
			libraries = append(libraries, *lib)
		}
	}

	// Sort so the inventory is byte-stable; per-library telemetry is already
	// ordered by the analyzer.
	slices.SortFunc(libraries, func(a, b Library) int { return cmp.Compare(a.Name, b.Name) })

	return &ScanResult{Libraries: libraries}, nil
}

// analyzeLibrary builds the library record for a single instrumentation module.
// Metadata is derived from the module's own go.mod directive.
func analyzeLibrary(goModPath string) (*Library, error) {
	mod, err := ParseModule(goModPath)
	if err != nil {
		return nil, err
	}
	if mod.Path == "" || !IsOTelContribRequire(mod.Path) {
		return nil, nil
	}
	meta := DeriveMetadata(mod)
	return &Library{Metadata: *meta}, nil
}

