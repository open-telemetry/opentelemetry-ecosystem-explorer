package metadata

import "gopkg.in/yaml.v3"

type InstrType int

const (
	InstrTypeWrapper      InstrType = iota // wraps existing handler/transport
	InstrTypeBridge                        // bridges another telemetry system to OTel
	InstrTypeExporter                      // ships telemetry to a backend
	InstrTypePropagator                    // injects/extracts context
	InstrTypeSDKComponent                  // part of the core SDK
)

var instrTypeStrings = [...]string{"wrapper", "bridge", "exporter", "propagator", "sdk_component"}

func (t InstrType) String() string { return instrTypeStrings[t] }

func (t InstrType) MarshalYAML() (interface{}, error) { return t.String(), nil }

func (t *InstrType) UnmarshalYAML(value *yaml.Node) error {
	for i, s := range instrTypeStrings {
		if value.Value == s {
			*t = InstrType(i)
			return nil
		}
	}
	return nil
}

type InstallType int

const (
	InstallTypeWrapper   InstallType = iota // wrap existing handler/transport
	InstallTypeImport                       // import + minimal config call
	InstallTypeAutomatic                    // no code change required
)

var installTypeStrings = [...]string{"wrapper", "import", "automatic"}

func (t InstallType) String() string { return installTypeStrings[t] }

func (t InstallType) MarshalYAML() (interface{}, error) { return t.String(), nil }

func (t *InstallType) UnmarshalYAML(value *yaml.Node) error {
	for i, s := range installTypeStrings {
		if value.Value == s {
			*t = InstallType(i)
			return nil
		}
	}
	return nil
}

type Stability int

const (
	StabilityDevelopment Stability = iota
	StabilityExperimental
	StabilityStable
)

var stabilityStrings = [...]string{"development", "experimental", "stable"}

func (s Stability) String() string { return stabilityStrings[s] }

func (s Stability) MarshalYAML() (interface{}, error) { return s.String(), nil }

func (s *Stability) UnmarshalYAML(value *yaml.Node) error {
	for i, str := range stabilityStrings {
		if value.Value == str {
			*s = Stability(i)
			return nil
		}
	}
	return nil
}

type Metadata struct {
	Name                string          `yaml:"name"`
	DisplayName         string          `yaml:"display_name"`
	Description         string          `yaml:"description"`
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

type Scope struct {
	Name    string `yaml:"name"`
	Version string `yaml:"version,omitempty"`
}

type Module struct {
	Path    string `yaml:"path"`
	Version string `yaml:"version"`
}

type Installation struct {
	Type        InstallType `yaml:"type"`
	Description string      `yaml:"description"`
	Example     string      `yaml:"example,omitempty"`
}

type Configuration struct {
	Name        string   `yaml:"name"`
	Description string   `yaml:"description"`
	Type        string   `yaml:"type"`
	Default     string   `yaml:"default"`
	Examples    []string `yaml:"examples,omitempty"`
}
