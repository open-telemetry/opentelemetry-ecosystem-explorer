// Package metadata defines the library metadata schema shared across the
// watcher ecosystem, along with its YAML (de)serialization.
//
// [Metadata] is the central record describing a single instrumentation library;
// it composes [Scope], [Module], [Installation], and [Configuration]. The
// enum-like types [InstrType], [InstallType], and [Stability] each marshal to
// and from a fixed set of YAML tokens.
package metadata

import "gopkg.in/yaml.v3"

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

// UnmarshalYAML decodes an [InstrType] from its YAML token, leaving the value
// unchanged when the token is unrecognized.
func (t *InstrType) UnmarshalYAML(value *yaml.Node) error {
	for i, s := range instrTypeStrings {
		if value.Value == s {
			*t = InstrType(i)
			return nil
		}
	}
	return nil
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

// UnmarshalYAML decodes an [InstallType] from its YAML token, leaving the value
// unchanged when the token is unrecognized.
func (t *InstallType) UnmarshalYAML(value *yaml.Node) error {
	for i, s := range installTypeStrings {
		if value.Value == s {
			*t = InstallType(i)
			return nil
		}
	}
	return nil
}

// Stability is the maturity level of an instrumentation library. Its YAML
// tokens are "experimental" and "stable".
type Stability int

const (
	StabilityExperimental Stability = iota // feature-complete but not yet production-ready
	StabilityStable                        // stable API, production-ready
)

var stabilityStrings = [...]string{"experimental", "stable"}

// String returns the YAML token for the [Stability].
func (s Stability) String() string { return stabilityStrings[s] }

// MarshalYAML encodes the [Stability] as its YAML token.
func (s Stability) MarshalYAML() (interface{}, error) { return s.String(), nil }

// UnmarshalYAML decodes a [Stability] from its YAML token, leaving the value
// unchanged when the token is unrecognized.
func (s *Stability) UnmarshalYAML(value *yaml.Node) error {
	for i, str := range stabilityStrings {
		if value.Value == str {
			*s = Stability(i)
			return nil
		}
	}
	return nil
}

// Metadata is the descriptive record for a single instrumentation library. It
// embeds [Scope], [Module], and [Installation], and carries an
// [InstrType], optional [Configuration] list, and a [Stability] level.
type Metadata struct {
	Name                string          `yaml:"name"`
	DisplayName         string          `yaml:"display_name"`
	Description         string          `yaml:"description,omitempty"`
	SourcePath          string          `yaml:"source_path"`
	Scope               Scope           `yaml:"scope"`
	Module              Module          `yaml:"module"`
	TargetModule        string          `yaml:"target_module,omitempty"`
	GoMinVersion        string          `yaml:"go_min_version,omitempty"`
	LibraryLink         string          `yaml:"library_link"`
	InstrumentationType InstrType       `yaml:"instrumentation_type"`
	Installation        Installation    `yaml:"installation"`
	SemanticConventions []string        `yaml:"semantic_conventions,omitempty"`
	Configurations      []Configuration `yaml:"configurations,omitempty"`
	Stability           Stability       `yaml:"stability"`
}

// Scope is the OpenTelemetry instrumentation scope (name and version).
type Scope struct {
	Name    string `yaml:"name"`
	Version string `yaml:"version,omitempty"`
}

// Module is the Go module that provides the instrumentation.
type Module struct {
	Path    string `yaml:"path"`
	Version string `yaml:"version"`
}

// Installation describes how a library is wired into an application. Its Type
// records the [InstallType].
type Installation struct {
	Type        InstallType `yaml:"type"`
	Description string      `yaml:"description,omitempty"`
	Example     string      `yaml:"example,omitempty"`
}

// Configuration is a single tunable option exposed by a library.
type Configuration struct {
	Name        string   `yaml:"name"`
	Description string   `yaml:"description"`
	Type        string   `yaml:"type"`
	Default     string   `yaml:"default"`
	Examples    []string `yaml:"examples,omitempty"`
}
