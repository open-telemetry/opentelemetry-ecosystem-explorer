// Package instrumentation scans OpenTelemetry Go instrumentation modules and
// produces a versioned inventory of [Library] records. For each module it
// parses the go.mod with [ParseModule] and derives descriptive metadata with
// [DeriveMetadata]. [ScanRepo] ties these steps together over an upstream
// repository checkout.
package instrumentation

import (
	"cmp"
	"path/filepath"
	"slices"

	"github.com/open-telemetry/opentelemetry-ecosystem-explorer/golang-instrumentation-watcher/metadata"
	"github.com/open-telemetry/opentelemetry-ecosystem-explorer/golang-instrumentation-watcher/repo"
)

// Library is the fused per-instrumentation record: [metadata.Metadata] derived
// from go.mod paired with any observed [Telemetry]. It mirrors the
// libraries[].telemetry[] shape used by the other ecosystem watchers.
type Library struct {
	metadata.Metadata `yaml:",inline"`
	Telemetry         []Telemetry `yaml:"telemetry,omitempty"` // spans and metrics emitted by the library
}

// ScanResult holds the output of a repository scan: the fused [Library] records
// that make up the versioned inventory.
type ScanResult struct {
	Libraries []Library // instrumentation libraries discovered in the scan
}

// ScanRepo walks the upstream repository rooted at repoPath and returns the
// fused [Library] records discovered within it. repoName selects the scan
// layout: [repo.RepoGo] scans the whole tree, while go-contrib repositories
// scan only the instrumentation and bridges subtrees. The returned libraries
// are sorted by name for a byte-stable inventory.
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

	slices.SortFunc(libraries, func(a, b Library) int { return cmp.Compare(a.Name, b.Name) })

	return &ScanResult{Libraries: libraries}, nil
}

// analyzeLibrary builds the [Library] for a single instrumentation module.
// Metadata is derived from the module's own go.mod directive via
// [DeriveMetadata]. It returns nil (and nil error) for modules that are not
// go-contrib requires.
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
