// Package metadata defines the library metadata schema shared across the
// watcher ecosystem, along with its YAML (de)serialization.
//
// [Metadata] is the central record describing a single instrumentation library;
// it composes [Scope], [Module], [Installation], and [Configuration]. The
// enum-like types [InstrType], [InstallType], and [Stability] each marshal to
// and from a fixed set of YAML tokens.
package metadata

import (
	"fmt"

	"gopkg.in/yaml.v3"
)

// InstrType classifies how an instrumentation library participates in telemetry.
// Its YAML tokens are "wrapper", "bridge", "exporter", "propagator", and
// "sdk_component".
type InstrType int

const (
	InstrTypeWrapper      InstrType = iota // wraps existing handler/transport
	InstrTypeBridge                        // bridges another telemetry system to OTel
	InstrTypeExporter                      // ships telemetry to a backend
	InstrTypePropagator                    // injects/extracts context
	InstrTypeSDKComponent                  // part of the core SDK
)

var instrTypeStrings = [...]string{"wrapper", "bridge", "exporter", "propagator", "sdk_component"}

// String returns the YAML token for the [InstrType].
func (t InstrType) String() string { return instrTypeStrings[t] }

// MarshalYAML encodes the [InstrType] as its YAML token.
func (t InstrType) MarshalYAML() (interface{}, error) { return t.String(), nil }

// UnmarshalYAML decodes an [InstrType] from its YAML token, returning an
// error if the token is unrecognized.
func (t *InstrType) UnmarshalYAML(value *yaml.Node) error {
	for i, s := range instrTypeStrings {
		if value.Value == s {
			*t = InstrType(i)
			return nil
		}
	}
	return fmt.Errorf("unknown instrumentation_type %q: must be one of %v", value.Value, instrTypeStrings)
}

// InstallType describes the integration effort required to adopt a library.
// Its YAML tokens are "wrapper", "import", and "automatic".
type InstallType int

const (
	InstallTypeWrapper   InstallType = iota // wrap existing handler/transport
	InstallTypeImport                       // import + minimal config call
	InstallTypeAutomatic                    // no code change required
)

var installTypeStrings = [...]string{"wrapper", "import", "automatic"}

// String returns the YAML token for the [InstallType].
func (t InstallType) String() string { return installTypeStrings[t] }

// MarshalYAML encodes the [InstallType] as its YAML token.
func (t InstallType) MarshalYAML() (interface{}, error) { return t.String(), nil }

// UnmarshalYAML decodes an [InstallType] from its YAML token, returning an
// error if the token is unrecognized.
func (t *InstallType) UnmarshalYAML(value *yaml.Node) error {
	for i, s := range installTypeStrings {
		if value.Value == s {
			*t = InstallType(i)
			return nil
		}
	}
	return fmt.Errorf("unknown install type %q: must be one of %v", value.Value, installTypeStrings)
}

// Stability is the maturity level of an instrumentation library. Its YAML
// tokens are "unknown", "experimental", and "stable".
type Stability int

const (
	StabilityUnknown      Stability = iota // unspecified, should be inferred
	StabilityExperimental                  // feature-complete but not yet production-ready
	StabilityStable                        // stable API, production-ready
)

var stabilityStrings = [...]string{"unknown", "experimental", "stable"}

// String returns the YAML token for the [Stability].
func (s Stability) String() string { return stabilityStrings[s] }

// MarshalYAML encodes the [Stability] as its YAML token.
func (s Stability) MarshalYAML() (interface{}, error) { return s.String(), nil }

// UnmarshalYAML decodes a [Stability] from its YAML token, returning an
// error if the token is unrecognized.
func (s *Stability) UnmarshalYAML(value *yaml.Node) error {
	for i, str := range stabilityStrings {
		if value.Value == str {
			*s = Stability(i)
			return nil
		}
	}
	return fmt.Errorf("unknown stability %q: must be one of %v", value.Value, stabilityStrings)
}

// Metadata is the descriptive record for a single instrumentation library. It
// embeds [Scope], [Modules], and [Installation], and carries an
// [InstrType], optional [Configuration] list, and a [Stability] level.
type Metadata struct {
	// Name is the unique identifier for the instrumentation library, often derived from its path.
	Name string `yaml:"name"`
	// DisplayName is a human-readable title for the library used in user interfaces.
	DisplayName string `yaml:"display_name"`
	// Description provides a brief overview of what the library instruments or its purpose.
	Description string `yaml:"description,omitempty"`
	// SourcePath is the relative directory path to the instrumentation package within its repository.
	SourcePath string `yaml:"source_path"`
	// Scope defines the OpenTelemetry instrumentation scope identity.
	Scope Scope `yaml:"scope"`
	// Modules identifies the Go modules that publish this instrumentation.
	Modules []Module `yaml:"modules,omitempty"`
	// TargetModule is the path of the third-party or standard library module that this library instruments.
	TargetModule string `yaml:"target_module,omitempty"`
	// GoMinVersion specifies the minimum Go version required to compile and use the library (e.g., "1.21").
	GoMinVersion string `yaml:"go_min_version,omitempty"`
	// OtelcMinVersion specifies the minimum compile-time instrumentation tool (otelc) version required.
	// Must be a valid semver (e.g. "v0.10.0").
	OtelcMinVersion string `yaml:"otelc_min_version,omitempty"`
	// Hidden indicates whether the instrumentation should be omitted from user-facing discovery UI.
	Hidden bool `yaml:"hidden,omitempty"`
	// LibraryLink is the URL to the main documentation or repository for the instrumented target library.
	LibraryLink string `yaml:"library_link"`
	// InstrumentationType classifies how this library participates in the telemetry pipeline.
	InstrumentationType InstrType `yaml:"instrumentation_type"`
	// Installation describes how users integrate this library into their applications.
	Installation Installation `yaml:"installation"`
	// SemanticConventions lists the OpenTelemetry semantic conventions that this library adheres to.
	SemanticConventions []string `yaml:"semantic_conventions,omitempty"`
	// Configurations lists the tunable options exposed by the library to users.
	Configurations []Configuration `yaml:"configurations,omitempty"`
	// Stability indicates the maturity and readiness level of the library for production use.
	Stability Stability `yaml:"stability"`
}

// Scope is the OpenTelemetry instrumentation scope (name and version).
type Scope struct {
	// Name is the instrumentation scope name, typically matching the Go module path.
	Name string `yaml:"name"`
	// Version is the instrumentation scope version.
	Version string `yaml:"version,omitempty"`
}

// Module is the Go module that provides the instrumentation.
type Module struct {
	// Path is the Go module path for the instrumentation (e.g., "go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp").
	Path string `yaml:"path"`
	// Version is the published version of the Go module.
	Version string `yaml:"version"`
}

// Installation describes how a library is wired into an application.
type Installation struct {
	// Methods specifies the approach(es) required to integrate the instrumentation.
	Methods []InstallType `yaml:"methods,omitempty"`
	// Description provides details on how to install and configure the instrumentation.
	Description string `yaml:"description,omitempty"`
	// Example contains a code snippet demonstrating how to apply the instrumentation.
	Example string `yaml:"example,omitempty"`
}

// Configuration is a single tunable option exposed by a library.
type Configuration struct {
	// Name is the name of the configuration option (often matching an Option type or function name).
	Name string `yaml:"name"`
	// Description explains what the configuration option does and how it affects behavior.
	Description string `yaml:"description"`
	// Type indicates the data type or Go type of the configuration option (e.g., "bool", "time.Duration").
	Type string `yaml:"type"`
	// Default is the string representation of the default value for this configuration option.
	Default string `yaml:"default"`
	// Examples provides optional code snippets or values demonstrating how to set this configuration.
	Examples []string `yaml:"examples,omitempty"`
}
