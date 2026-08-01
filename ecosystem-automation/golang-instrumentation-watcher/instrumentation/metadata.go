package instrumentation

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/open-telemetry/opentelemetry-ecosystem-explorer/golang-instrumentation-watcher/metadata"
	"golang.org/x/mod/modfile"
	"golang.org/x/mod/semver"
)

const otelContribPrefix = "go.opentelemetry.io/contrib/"

var bridgeTargetMap = map[string]string{
	"otelslog":   "log/slog",
	"otellogr":   "github.com/go-logr/logr",
	"otelzap":    "go.uber.org/zap",
	"otellogrus": "github.com/sirupsen/logrus",
}

// ContribRequire is the identity of a go-contrib module: its module path,
// version, and declared Go version. It is the per-module source of truth that
// [DeriveMetadata] turns into a library's descriptive metadata.
type ContribRequire struct {
	Path      string
	Version   string
	GoVersion string
}

// IsOTelContribRequire reports whether path is a go.opentelemetry.io/contrib module path.
func IsOTelContribRequire(path string) bool {
	return strings.HasPrefix(path, otelContribPrefix)
}

// ParseModule reads the go.mod at goModPath and returns the module's own
// identity as a [ContribRequire], taking the path from its module directive and
// the Go version from its go directive. The returned Version is empty, since a
// module's own go.mod does not record its release version.
func ParseModule(goModPath string) (ContribRequire, error) {
	data, err := os.ReadFile(goModPath)
	if err != nil {
		return ContribRequire{}, err
	}
	f, err := modfile.Parse(goModPath, data, nil)
	if err != nil {
		return ContribRequire{}, err
	}
	var goVer string
	if f.Go != nil {
		goVer = f.Go.Version
	}
	var modPath string
	if f.Module != nil {
		modPath = f.Module.Mod.Path
	}
	return ContribRequire{Path: modPath, GoVersion: goVer}, nil
}

// DeriveMetadata builds a library's descriptive [metadata.Metadata] from its
// go-contrib module identity r, inferring its name, display name, target
// module, instrumentation type, installation type, and documentation links.
func DeriveMetadata(r ContribRequire) *metadata.Metadata {
	// sourcePath is the repo-relative path after the module root prefix, e.g.
	// "instrumentation/net/http/otelhttp" or "bridges/otelslog". We use it as
	// the stable, globally-unique Name (slashes → hyphens) so that modules
	// sharing a leaf directory—like the two otelmongo variants—remain distinct.
	// DisplayName keeps the short leaf form for human-facing output.
	sourcePath := strings.TrimPrefix(r.Path, "go.opentelemetry.io/contrib/")
	name := strings.ReplaceAll(sourcePath, "/", "-")
	leaf := filepath.Base(r.Path)
	instrType := inferInstrType(r.Path)
	return &metadata.Metadata{
		Name:                name,
		DisplayName:         inferDisplayName(leaf),
		SourcePath:          sourcePath,
		Scope:               metadata.Scope{Name: r.Path},
		Module:              metadata.Module{Path: r.Path, Version: r.Version},
		TargetModule:        inferTarget(r.Path, leaf),
		GoMinVersion:        r.GoVersion,
		LibraryLink:         "https://pkg.go.dev/" + r.Path,
		InstrumentationType: instrType,
		Installation:        metadata.Installation{Type: inferInstallType(instrType)},
		Stability:           inferStability(r.Version),
	}
}

func inferInstrType(path string) metadata.InstrType {
	suffix := strings.TrimPrefix(path, otelContribPrefix)
	switch {
	case strings.HasPrefix(suffix, "bridges/"):
		return metadata.InstrTypeBridge
	case strings.HasPrefix(suffix, "exporters/"):
		return metadata.InstrTypeExporter
	case strings.HasPrefix(suffix, "propagators/"):
		return metadata.InstrTypePropagator
	case strings.HasPrefix(suffix, "samplers/"):
		return metadata.InstrTypeSDKComponent
	default:
		return metadata.InstrTypeWrapper
	}
}

func inferInstallType(t metadata.InstrType) metadata.InstallType {
	if t == metadata.InstrTypeWrapper {
		return metadata.InstallTypeWrapper
	}
	return metadata.InstallTypeImport
}

func inferStability(version string) metadata.Stability {
	major := semver.Major(version)
	switch major {
	case "v1":
		// >= v1 is considered stable
		return metadata.StabilityStable
	case "v0":
		// < v1 is considered experimental
		return metadata.StabilityExperimental
	default:
		// default to experimental for unversioned modules
		return metadata.StabilityExperimental
	}
}

func inferTarget(path, name string) string {
	if target, ok := bridgeTargetMap[name]; ok {
		return target
	}
	suffix := strings.TrimPrefix(path, otelContribPrefix)
	if rest, ok := strings.CutPrefix(suffix, "instrumentation/"); ok {
		parts := strings.Split(rest, "/")
		if len(parts) > 1 {
			return strings.Join(parts[:len(parts)-1], "/")
		}
	}
	return ""
}

func inferDisplayName(name string) string {
	stripped := strings.TrimPrefix(name, "otel")
	if d, ok := displayNameMap[stripped]; ok {
		return d
	}
	return stripped
}
