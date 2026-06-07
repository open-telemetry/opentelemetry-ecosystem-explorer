package instrumentation

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/open-telemetry/opentelemetry-ecosystem-explorer/golang-instrumentation-watcher/metadata"
	"golang.org/x/mod/modfile"
	"gopkg.in/yaml.v3"
)

const otelContribPrefix = "go.opentelemetry.io/contrib/"

var bridgeTargetMap = map[string]string{
	"otelslog":   "log/slog",
	"otellogr":   "github.com/go-logr/logr",
	"otelzap":    "go.uber.org/zap",
	"otellogrus": "github.com/sirupsen/logrus",
}

var bridgeDisplayNames = map[string]string{
	"slog":   "slog",
	"logr":   "logr",
	"zap":    "zap",
	"logrus": "logrus",
}

type ContribRequire struct {
	Path      string
	Version   string
	GoVersion string
}

func IsOTelContribRequire(path string) bool {
	return strings.HasPrefix(path, otelContribPrefix)
}

// ParseModule reads a go.mod and returns the module's own identity (its
// `module` directive path and `go` version) as a ContribRequire. This is the
// per-module source of truth used to derive a library's metadata.
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

func DeriveMetadata(r ContribRequire) *metadata.Metadata {
	name := filepath.Base(r.Path)
	instrType := inferInstrType(r.Path)
	return &metadata.Metadata{
		Name:                name,
		DisplayName:         inferDisplayName(name),
		SourcePath:          strings.TrimPrefix(r.Path, "go.opentelemetry.io/contrib/"),
		Scope:               metadata.Scope{Name: r.Path},
		Module:              metadata.Module{Path: r.Path, Version: r.Version},
		TargetModule:        inferTarget(r.Path, name),
		GoMinVersion:        r.GoVersion,
		LibraryLink:         "https://pkg.go.dev/" + r.Path,
		InstrumentationType: instrType,
		Installation:        metadata.Installation{Type: inferInstallType(instrType)},
		Stability:           metadata.StabilityExperimental,
	}
}

func GenerateMetadataYAML(path string, m *metadata.Metadata) error {
	if existing, err := loadMetadata(path); err == nil && existing.Description != "" {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	return encodeYAMLFile(path, m)
}

func loadMetadata(path string) (*metadata.Metadata, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var m metadata.Metadata
	if err := yaml.Unmarshal(data, &m); err != nil {
		return nil, fmt.Errorf("%s: %w", path, err)
	}
	return &m, nil
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
	if d, ok := bridgeDisplayNames[stripped]; ok {
		return d
	}
	if d, ok := displayNameMap[name]; ok {
		return d
	}
	return name
}
