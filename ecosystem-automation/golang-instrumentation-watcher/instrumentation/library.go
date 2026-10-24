// Package instrumentation scans OpenTelemetry Go instrumentation modules and
// produces a versioned inventory of [Library] records. For each module it
// parses the go.mod with [ParseModule] and derives descriptive metadata with
// [DeriveMetadata]. [ScanRepo] ties these steps together over an upstream
// repository checkout.
package instrumentation

import (
	"bytes"
	"cmp"
	"fmt"
	"go/version"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"golang.org/x/mod/semver"
	"gopkg.in/yaml.v3"

	"github.com/open-telemetry/opentelemetry-ecosystem-explorer/golang-instrumentation-watcher/metadata"
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

// ScanRepo walks the go-contrib repository rooted at repoPath and returns the
// fused [Library] records discovered within it. It scans only the subtrees that
// instrument a developer's code: instrumentation wrappers (gin, grpc, http…)
// and bridges (zap, logrus…). The other go-contrib components (exporters,
// propagators, samplers, detectors, processors) configure the SDK pipeline
// rather than instrument a target library, so they have no target_module and
// are out of scope here.
//
// A scan error is returned rather than swallowed: a missing subtree or an
// unreadable go.mod would otherwise produce a smaller inventory that commits as
// a spurious "libraries removed" diff. The returned libraries are sorted by name
// for a byte-stable inventory.
func ScanRepo(repoPath string) (*ScanResult, error) {
	var libraries []Library
	for _, sub := range []string{"instrumentation", "bridges"} {
		packages, err := Walk(filepath.Join(repoPath, sub))
		if err != nil {
			return nil, err
		}
		for _, pkg := range packages {
			lib, err := analyzeLibrary(pkg.GoModPath)
			if err != nil {
				return nil, err
			}
			if lib == nil {
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

// ScanMetadataRepo walks the repository rooted at repoPath looking for
// metadata.yaml files. It parses each file into a [Library] record, fusing
// it into a [ScanResult].
func ScanMetadataRepo(repoPath string) (*ScanResult, error) {
	metaFiles, err := WalkMetadata(repoPath)
	if err != nil {
		return nil, err
	}

	// Pre-scan all go.mod files to infer GoMinVersion if blank.
	modVersions := make(map[string]string)
	if packages, err := Walk(repoPath); err == nil {
		for _, pkg := range packages {
			mod, err := ParseModule(pkg.GoModPath)
			if err != nil {
				fmt.Fprintf(os.Stderr, "failed to parse go.mod %s: %v\n", pkg.GoModPath, err)
				continue
			}
			if mod.Path == "" {
				fmt.Fprintf(os.Stderr, "missing module path in go.mod: %s\n", pkg.GoModPath)
				continue
			}

			modVersions[mod.Path] = mod.GoVersion
		}
	} else {
		fmt.Fprintf(os.Stderr, "failed to walk repository for go.mod files: %v\n", err)
	}

	var libraries []Library
	seenNames := make(map[string]bool)

	for _, mf := range metaFiles {
		lib, err := analyzeMetadataLibrary(mf.MetadataPath)
		if err != nil {
			return nil, err
		}
		if lib == nil {
			continue
		}

		if lib.Name == "" {
			return nil, fmt.Errorf("empty name field in %s", mf.MetadataPath)
		}
		if seenNames[lib.Name] {
			return nil, fmt.Errorf("duplicate library name %q in %s", lib.Name, mf.MetadataPath)
		}
		seenNames[lib.Name] = true

		if lib.SourcePath == "" {
			lib.SourcePath = mf.Path
		}

		// Infer GoMinVersion from go.mod if not specified in metadata.
		lib.inferGoMinVersion(modVersions)

		// Strictly validate explicitly authored versions
		if err := lib.validateVersions(mf.MetadataPath); err != nil {
			return nil, err
		}

		libraries = append(libraries, *lib)
	}

	slices.SortFunc(libraries, func(a, b Library) int { return cmp.Compare(a.Name, b.Name) })

	return &ScanResult{Libraries: libraries}, nil
}

func (l *Library) validateVersions(metadataPath string) error {
	if l.GoMinVersion != "" {
		if !version.IsValid("go" + l.GoMinVersion) {
			return fmt.Errorf("invalid go_min_version %q in %s", l.GoMinVersion, metadataPath)
		}
	}

	if l.OtelcMinVersion != "" {
		if !semver.IsValid(l.OtelcMinVersion) {
			return fmt.Errorf("invalid otelc_min_version %q in %s: must be a valid semver", l.OtelcMinVersion, metadataPath)
		}
	}

	for _, m := range l.Modules {
		if m.Version != "" && !semver.IsValid(m.Version) {
			return fmt.Errorf("invalid module version %q in %s", m.Version, metadataPath)
		}
	}
	return nil
}

func (l *Library) inferGoMinVersion(modVersions map[string]string) {
	if l.GoMinVersion != "" {
		return
	}
	var highest string
	for _, m := range l.Modules {
		if gv, ok := modVersions[m.Path]; ok && gv != "" {
			if highest == "" || version.Compare("go"+gv, "go"+highest) > 0 {
				highest = gv
			}
		}
	}
	l.GoMinVersion = highest
}

func analyzeMetadataLibrary(metadataPath string) (*Library, error) {
	data, err := os.ReadFile(metadataPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read %s: %w", metadataPath, err)
	}

	var lib Library
	dec := yaml.NewDecoder(bytes.NewReader(data))
	dec.KnownFields(true)
	if err := dec.Decode(&lib); err != nil {
		return nil, fmt.Errorf("failed to unmarshal %s: %w", metadataPath, err)
	}
	if err := validateConfigurationEntries(lib.Configurations, metadataPath); err != nil {
		return nil, err
	}

	return &lib, nil
}

// validateConfigurationEntries validates declarative selector and type/schema
// consistency. Entries without declarative selectors remain valid legacy
// Go-only options. Shared refs are intentionally left unresolved here; otelc
// owns reference lookup and full semantic validation.
func validateConfigurationEntries(configurations []metadata.Configuration, metadataPath string) error {
	for i, configuration := range configurations {
		hasDeclarativeName := configuration.DeclarativeName != nil
		hasRef := configuration.Ref != nil
		if hasDeclarativeName && hasRef {
			return fmt.Errorf("invalid configurations[%d] in %s: exactly one of declarative_name or ref must be set", i, metadataPath)
		}
		if !hasDeclarativeName && !hasRef {
			if configuration.DeclarativeType != nil || configuration.DeclarativeSchema != nil {
				return fmt.Errorf("invalid configurations[%d] in %s: declarative_type or declarative_schema requires declarative_name or ref", i, metadataPath)
			}
			continue
		}
		if hasDeclarativeName && strings.TrimSpace(*configuration.DeclarativeName) == "" {
			return fmt.Errorf("invalid configurations[%d] in %s: declarative_name must not be empty", i, metadataPath)
		}
		if hasDeclarativeName && strings.TrimSpace(*configuration.DeclarativeName) != *configuration.DeclarativeName {
			return fmt.Errorf("invalid configurations[%d] in %s: declarative_name must not have leading or trailing whitespace", i, metadataPath)
		}
		if hasRef && strings.TrimSpace(*configuration.Ref) == "" {
			return fmt.Errorf("invalid configurations[%d] in %s: ref must not be empty", i, metadataPath)
		}
		if hasRef && strings.TrimSpace(*configuration.Ref) != *configuration.Ref {
			return fmt.Errorf("invalid configurations[%d] in %s: ref must not have leading or trailing whitespace", i, metadataPath)
		}
		if hasRef && (configuration.Name != "" || configuration.Description != "" || configuration.Type != "" ||
			configuration.Default != nil || len(configuration.Examples) > 0 || configuration.DeclarativeType != nil ||
			configuration.DeclarativeSchema != nil) {
			return fmt.Errorf("invalid configurations[%d] in %s: a ref entry must not include inline configuration fields", i, metadataPath)
		}
		if configuration.DeclarativeType != nil && !isSupportedDeclarativeType(*configuration.DeclarativeType) {
			return fmt.Errorf("invalid configurations[%d] in %s: unsupported declarative_type %q", i, metadataPath, *configuration.DeclarativeType)
		}
		if configuration.DeclarativeSchema != nil {
			if configuration.DeclarativeType == nil || *configuration.DeclarativeType != "structured_list" {
				return fmt.Errorf("invalid configurations[%d] in %s: declarative_schema requires declarative_type structured_list", i, metadataPath)
			}
			if configuration.DeclarativeSchema.Type != "object" {
				return fmt.Errorf("invalid configurations[%d] in %s: declarative_schema type must be object", i, metadataPath)
			}
		}
		if configuration.DeclarativeType != nil && *configuration.DeclarativeType == "structured_list" && configuration.DeclarativeSchema == nil {
			return fmt.Errorf("invalid configurations[%d] in %s: structured_list requires declarative_schema", i, metadataPath)
		}
	}
	return nil
}

func isSupportedDeclarativeType(value string) bool {
	switch value {
	case "boolean", "string", "int", "map", "list", "structured_list":
		return true
	default:
		return false
	}
}
