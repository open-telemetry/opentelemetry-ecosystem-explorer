package instrumentation

import (
	"os"
	"path/filepath"
	"reflect"
	"slices"
	"strings"
	"testing"

	"gopkg.in/yaml.v3"

	"github.com/open-telemetry/opentelemetry-ecosystem-explorer/golang-instrumentation-watcher/metadata"
)

const (
	dirPerm  = 0o744
	filePerm = 0o644
)

// modFile returns minimal go.mod source declaring modulePath.
func modFile(modulePath string) string {
	return "module " + modulePath + "\n\ngo 1.24.0\n"
}

// writeModule writes a fixture module (go.mod + doc.go) in a fresh temp dir and
// returns the path to its go.mod.
func writeModule(t *testing.T, modulePath string) string {
	t.Helper()
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "go.mod"), []byte(modFile(modulePath)), filePerm); err != nil {
		t.Fatal(err)
	}
	pkgName := filepath.Base(modulePath)
	doc := "// Package " + pkgName + " is a test fixture.\npackage " + pkgName + "\n"
	if err := os.WriteFile(filepath.Join(dir, "doc.go"), []byte(doc), filePerm); err != nil {
		t.Fatal(err)
	}
	return filepath.Join(dir, "go.mod")
}

// writeGoMod writes content as a go.mod under root/relDir, creating the dir.
func writeGoMod(t *testing.T, root, relDir, content string) {
	t.Helper()
	dir := filepath.Join(root, relDir)
	if err := os.MkdirAll(dir, dirPerm); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "go.mod"), []byte(content), filePerm); err != nil {
		t.Fatal(err)
	}
}

func TestAnalyzeLibrary(t *testing.T) {
	tests := []struct {
		name       string
		modulePath string
		wantNil    bool
		wantName   string
		wantType   metadata.InstrType
	}{
		{
			name:       "contrib instrumentation module",
			modulePath: "go.opentelemetry.io/contrib/instrumentation/example.com/widget/otelwidget",
			wantName:   "instrumentation-example.com-widget-otelwidget",
			wantType:   metadata.InstrTypeWrapper,
		},
		{
			name:       "non-contrib module",
			modulePath: "example.com/not/contrib/thing",
			wantNil:    true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			lib, err := analyzeLibrary(writeModule(t, tt.modulePath))
			if err != nil {
				t.Fatalf("analyzeLibrary() error = %v", err)
			}
			if tt.wantNil {
				if lib != nil {
					t.Errorf("analyzeLibrary() = %+v, want nil", lib)
				}
				return
			}
			if lib == nil {
				t.Fatal("analyzeLibrary() returned nil, want non-nil")
			}
			if lib.Name != tt.wantName {
				t.Errorf("Name = %q, want %q", lib.Name, tt.wantName)
			}
			if lib.InstrumentationType != tt.wantType {
				t.Errorf("InstrumentationType = %v, want %v", lib.InstrumentationType, tt.wantType)
			}
			if len(lib.Telemetry) != 0 {
				t.Errorf("Telemetry = %d entries, want 0 (no analyzer in extract phase)", len(lib.Telemetry))
			}
		})
	}
}

// writeMetadata writes content as a metadata.yaml under root/relDir, creating the dir.
func writeMetadata(t *testing.T, root, relDir, content string) {
	t.Helper()
	dir := filepath.Join(root, relDir)
	if err := os.MkdirAll(dir, dirPerm); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "metadata.yaml"), []byte(content), filePerm); err != nil {
		t.Fatal(err)
	}
}

func TestScanMetadataRepo(t *testing.T) {
	tests := []struct {
		name          string
		goVersion     string
		metaConfig    string
		wantLibs      int
		wantError     bool
		setupOverride func(*testing.T, string)
		assertLib     func(*testing.T, Library)
	}{
		{
			name:      "infers GoMinVersion from go.mod",
			goVersion: "1.25.0",
			metaConfig: `name: test-lib
modules:
  - path: go.opentelemetry.io/otelc/dummy
`,
			wantLibs: 1,
			assertLib: func(t *testing.T, l Library) {
				if l.GoMinVersion != "1.25.0" {
					t.Errorf("GoMinVersion = %q, want 1.25.0", l.GoMinVersion)
				}
			},
		},
		{
			name:      "respects explicitly authored GoMinVersion",
			goVersion: "1.25.0",
			metaConfig: `name: test-lib
go_min_version: "1.20"
modules:
  - path: go.opentelemetry.io/otelc/dummy
`,
			wantLibs: 1,
			assertLib: func(t *testing.T, l Library) {
				if l.GoMinVersion != "1.20" {
					t.Errorf("GoMinVersion = %q, want 1.20 (should not be overwritten)", l.GoMinVersion)
				}
			},
		},
		{
			name:      "multi-module picks highest go version",
			goVersion: "1.20.0", // Ignored because we define two specific modules
			metaConfig: `name: multi-lib
modules:
  - path: go.opentelemetry.io/otelc/mod1
  - path: go.opentelemetry.io/otelc/mod2
`,
			wantLibs: 1,
			setupOverride: func(t *testing.T, root string) {
				writeGoMod(t, root, "instrumentation/mod1", "module go.opentelemetry.io/otelc/mod1\n\ngo 1.20\n")
				writeGoMod(t, root, "instrumentation/mod2", "module go.opentelemetry.io/otelc/mod2\n\ngo 1.25.0\n")
			},
			assertLib: func(t *testing.T, l Library) {
				if l.GoMinVersion != "1.25.0" {
					t.Errorf("GoMinVersion = %q, want 1.25.0", l.GoMinVersion)
				}
				if l.SourcePath == "" {
					t.Errorf("SourcePath was not injected")
				}
			},
		},
		{
			name:      "round-trips new fields and respects authored source_path",
			goVersion: "1.25.0",
			metaConfig: `name: exhaustive-lib
source_path: custom/path
hidden: true
otelc_min_version: v0.10.0
installation:
  methods:
    - automatic
    - wrapper
modules:
  - path: go.opentelemetry.io/otelc/exhaustive
`,
			wantLibs: 1,
			assertLib: func(t *testing.T, l Library) {
				if l.SourcePath != "custom/path" {
					t.Errorf("SourcePath = %q, want custom/path", l.SourcePath)
				}
				if !l.Hidden {
					t.Errorf("Hidden = false, want true")
				}
				if l.OtelcMinVersion != "v0.10.0" {
					t.Errorf("OtelcMinVersion = %q, want v0.10.0", l.OtelcMinVersion)
				}
				if len(l.Installation.Methods) != 2 {
					t.Fatalf("Installation methods len = %d, want 2", len(l.Installation.Methods))
				}
			},
		},
		{
			name:      "malformed metadata yields error",
			goVersion: "1.25.0",
			metaConfig: `name: bad-lib
instalation: # typo should fail strict decoding
  methods: [automatic]
`,
			wantError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			root := t.TempDir()

			if tt.setupOverride != nil {
				tt.setupOverride(t, root)
			} else {
				writeGoMod(t, root, "instrumentation/dummy", "module go.opentelemetry.io/otelc/dummy\n\ngo "+tt.goVersion+"\n")
			}

			writeMetadata(t, root, "instrumentation/dummy", tt.metaConfig)

			res, err := ScanMetadataRepo(root)
			if tt.wantError {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("ScanMetadataRepo() error = %v", err)
			}
			if len(res.Libraries) != tt.wantLibs {
				t.Fatalf("Got %d libraries, want %d", len(res.Libraries), tt.wantLibs)
			}
			if tt.wantLibs > 0 {
				tt.assertLib(t, res.Libraries[0])
			}
		})
	}
}

func TestScanMetadataRepoConfigurationEntryShape(t *testing.T) {
	tests := []struct {
		name         string
		config       string
		wantError    string
		wantName     string
		wantType     string
		wantDefault  string
		checkDefault bool
		wantInline   bool
		wantRef      bool
		wantSchema   bool
		wantLegacy   bool
	}{
		{
			name: "inline declarative configuration",
			config: `- name: otel.instrumentation.http.enabled
  declarative_name: go.net_http.enabled
  description: Enables HTTP instrumentation.
  type: boolean
  default: true`,
			wantName:     "otel.instrumentation.http.enabled",
			wantType:     "boolean",
			wantDefault:  "true",
			checkDefault: true,
			wantInline:   true,
		},
		{
			name: "structured declarative configuration",
			config: `- declarative_name: go.http.client.rules
  description: HTTP client rules.
  type: list
  default: ""
  declarative_type: structured_list
  declarative_schema:
    type: object
    required: [pattern]
    properties:
      pattern:
        type: string
        example: "/users/{id}"
      enabled:
        type: boolean
        default: false`,
			wantInline: true,
			wantSchema: true,
		},
		{
			name:    "shared reference",
			config:  `- ref: http.client.capture-request-headers`,
			wantRef: true,
		},
		{
			name: "both selectors",
			config: `- declarative_name: go.net_http.enabled
  ref: http.client.capture-request-headers`,
			wantError: "exactly one of declarative_name or ref",
		},
		{
			name: "shared reference with inline fields",
			config: `- ref: http.client.capture-request-headers
  type: list`,
			wantError: "a ref entry must not include inline configuration fields",
		},
		{
			name: "legacy Go-only configuration without selectors",
			config: `- name: otel.instrumentation.http.enabled
  type: bool
  default: "true"`,
			wantName:     "otel.instrumentation.http.enabled",
			wantType:     "bool",
			wantDefault:  "true",
			checkDefault: true,
			wantLegacy:   true,
		},
		{
			name:      "empty declarative name",
			config:    `- declarative_name: ""`,
			wantError: "declarative_name must not be empty",
		},
		{
			name:      "empty ref",
			config:    `- ref: ""`,
			wantError: "ref must not be empty",
		},
		{
			name:      "declarative fields require a selector",
			config:    `- declarative_type: boolean`,
			wantError: "declarative_type or declarative_schema requires declarative_name or ref",
		},
		{
			name:      "declarative name with surrounding whitespace",
			config:    `- declarative_name: " go.net_http.enabled "`,
			wantError: "declarative_name must not have leading or trailing whitespace",
		},
		{
			name:      "ref with surrounding whitespace",
			config:    `- ref: " http.client.capture-request-headers "`,
			wantError: "ref must not have leading or trailing whitespace",
		},
		{
			name: "unknown declarative type",
			config: `- declarative_name: go.net_http.enabled
  declarative_type: str`,
			wantError: "unsupported declarative_type \"str\"",
		},
		{
			name: "schema on scalar declarative type",
			config: `- declarative_name: go.net_http.enabled
  declarative_type: boolean
  declarative_schema:
    type: object
    properties: {}`,
			wantError: "declarative_schema requires declarative_type structured_list",
		},
		{
			name: "structured list requires schema",
			config: `- declarative_name: go.http.client.rules
  declarative_type: structured_list`,
			wantError: "structured_list requires declarative_schema",
		},
		{
			name: "schema must describe an object",
			config: `- declarative_name: go.http.client.rules
  declarative_type: structured_list
  declarative_schema:
    type: string
    properties: {}`,
			wantError: "declarative_schema type must be object",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			root := t.TempDir()
			writeGoMod(t, root, "instrumentation/dummy", "module go.opentelemetry.io/otelc/dummy\n\ngo 1.25.0\n")
			writeMetadata(t, root, "instrumentation/dummy", "name: test-lib\nconfigurations:\n"+tt.config+"\n")

			result, err := ScanMetadataRepo(root)
			if tt.wantError != "" {
				if err == nil || !strings.Contains(err.Error(), tt.wantError) {
					t.Fatalf("ScanMetadataRepo() error = %v, want error containing %q", err, tt.wantError)
				}
				return
			}
			if err != nil {
				t.Fatalf("ScanMetadataRepo() error = %v", err)
			}
			if len(result.Libraries) != 1 {
				t.Fatalf("libraries = %d, want 1", len(result.Libraries))
			}
			configurations := result.Libraries[0].Configurations
			if len(configurations) != 1 {
				t.Fatalf("configurations = %d, want 1", len(configurations))
			}
			configuration := configurations[0]
			if got := configuration.DeclarativeName != nil; got != tt.wantInline {
				t.Errorf("declarative_name present = %v, want %v", got, tt.wantInline)
			}
			if got := configuration.Ref != nil; got != tt.wantRef {
				t.Errorf("ref present = %v, want %v", got, tt.wantRef)
			}
			if tt.wantInline || tt.wantLegacy {
				if configuration.Name != tt.wantName {
					t.Errorf("name = %q, want %q", configuration.Name, tt.wantName)
				}
				if tt.wantType != "" && configuration.Type != tt.wantType {
					t.Errorf("type = %q, want %q", configuration.Type, tt.wantType)
				}
				if tt.checkDefault && (configuration.Default == nil || *configuration.Default != tt.wantDefault) {
					t.Errorf("default = %v, want string %q", configuration.Default, tt.wantDefault)
				}
				if tt.wantSchema {
					if configuration.DeclarativeSchema == nil {
						t.Fatal("declarative_schema = nil, want schema")
					}
					if got := configuration.DeclarativeSchema.Properties["enabled"].Default; got != false {
						t.Errorf("schema property default = %#v, want false bool", got)
					}
				}
			}
			if tt.wantRef && (configuration.Ref == nil || *configuration.Ref != "http.client.capture-request-headers") {
				t.Errorf("ref = %v, want http.client.capture-request-headers", configuration.Ref)
			}

			serialized, err := yaml.Marshal(result.Libraries[0])
			if err != nil {
				t.Fatalf("Marshal() error = %v", err)
			}
			var roundTripped Library
			if err := yaml.Unmarshal(serialized, &roundTripped); err != nil {
				t.Fatalf("Unmarshal() error = %v", err)
			}
			if !reflect.DeepEqual(roundTripped.Configurations, configurations) {
				t.Errorf("round-tripped configurations = %#v, want %#v", roundTripped.Configurations, configurations)
			}
		})
	}
}

func TestScanRepo(t *testing.T) {
	const contrib = "go.opentelemetry.io/contrib/"

	tests := []struct {
		name      string
		setup     func(t *testing.T) string // builds the repo tree, returns its root
		wantErr   bool
		wantNames []string // expected library names, in returned (sorted) order
	}{
		{
			name: "fuses contrib modules from both subtrees, sorted, non-contrib dropped",
			setup: func(t *testing.T) string {
				root := t.TempDir()
				writeGoMod(t, root, "instrumentation/net/http/otelhttp", modFile(contrib+"instrumentation/net/http/otelhttp"))
				writeGoMod(t, root, "instrumentation/example.com/other", modFile("example.com/other")) // non-contrib, dropped
				writeGoMod(t, root, "bridges/otelslog", modFile(contrib+"bridges/otelslog"))
				return root
			},
			wantNames: []string{"bridges-otelslog", "instrumentation-net-http-otelhttp"},
		},
		{
			name:    "missing subtree fails hard rather than shipping an empty inventory",
			setup:   func(t *testing.T) string { return t.TempDir() }, // no instrumentation/ or bridges/
			wantErr: true,
		},
		{
			name: "malformed go.mod fails hard rather than dropping a library",
			setup: func(t *testing.T) string {
				root := t.TempDir()
				// bridges/ is valid, so a parse error is the only possible failure.
				writeGoMod(t, root, "bridges/otelslog", modFile(contrib+"bridges/otelslog"))
				writeGoMod(t, root, "instrumentation/broken", "module \"unterminated\n")
				return root
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res, err := ScanRepo(tt.setup(t))
			if tt.wantErr {
				if err == nil {
					t.Fatal("ScanRepo() error = nil, want error")
				}
				if res != nil {
					t.Errorf("ScanRepo() result = %+v, want nil on error", res)
				}
				return
			}
			if err != nil {
				t.Fatalf("ScanRepo() error = %v", err)
			}
			got := make([]string, len(res.Libraries))
			for i, lib := range res.Libraries {
				got[i] = lib.Name
			}
			if !slices.Equal(got, tt.wantNames) {
				t.Errorf("ScanRepo() names = %v, want %v", got, tt.wantNames)
			}
		})
	}
}
