package instrumentation

import (
	"testing"

	"github.com/open-telemetry/opentelemetry-ecosystem-explorer/golang-instrumentation-watcher/metadata"
)

func TestIsOTelContribRequire(t *testing.T) {
	cases := []struct {
		path string
		want bool
	}{
		{"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp", true},
		{"go.opentelemetry.io/contrib/bridges/otelslog", true},
		{"go.opentelemetry.io/otel", false},
		{"go.opentelemetry.io/otel/sdk", false},
		{"go.opentelemetry.io/otel/exporters/stdout/stdouttrace", false},
		{"github.com/some/other", false},
	}
	for _, tc := range cases {
		if got := IsOTelContribRequire(tc.path); got != tc.want {
			t.Errorf("IsOTelContribRequire(%q) = %v, want %v", tc.path, got, tc.want)
		}
	}
}

func TestDeriveMetadata(t *testing.T) {
	cases := []struct {
		req           ContribRequire
		wantName      string
		wantType      metadata.InstrType
		wantInstall   metadata.InstallType
		wantTarget    string
		wantSource    string
		wantLibLink   string
		wantStability metadata.Stability
	}{
		{
			req:           ContribRequire{Path: "go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp", Version: "v0.68.0", GoVersion: "1.21"},
			wantName:      "instrumentation-net-http-otelhttp",
			wantType:      metadata.InstrTypeWrapper,
			wantInstall:   metadata.InstallTypeWrapper,
			wantTarget:    "net/http",
			wantSource:    "instrumentation/net/http/otelhttp",
			wantLibLink:   "https://pkg.go.dev/go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp",
			wantStability: metadata.StabilityExperimental,
		},
		{
			req:           ContribRequire{Path: "go.opentelemetry.io/contrib/bridges/otelslog", Version: "v0.9.0", GoVersion: "1.21"},
			wantName:      "bridges-otelslog",
			wantType:      metadata.InstrTypeBridge,
			wantInstall:   metadata.InstallTypeImport,
			wantTarget:    "log/slog",
			wantSource:    "bridges/otelslog",
			wantLibLink:   "https://pkg.go.dev/go.opentelemetry.io/contrib/bridges/otelslog",
			wantStability: metadata.StabilityExperimental,
		},
		{
			req:           ContribRequire{Path: "go.opentelemetry.io/contrib/exporters/autoexport", Version: "v0.1.0"},
			wantName:      "exporters-autoexport",
			wantType:      metadata.InstrTypeExporter,
			wantInstall:   metadata.InstallTypeImport,
			wantStability: metadata.StabilityExperimental,
		},
		{
			req:           ContribRequire{Path: "go.opentelemetry.io/contrib", Version: "v1.44.0"},
			wantName:      "go.opentelemetry.io-contrib",
			wantStability: metadata.StabilityStable,
		},
		// Uniqueness: both mongo modules share the leaf "otelmongo" but derive
		// distinct Names from their full source paths.
		{
			req:      ContribRequire{Path: "go.opentelemetry.io/contrib/instrumentation/go.mongodb.org/mongo-driver/mongo/otelmongo"},
			wantName: "instrumentation-go.mongodb.org-mongo-driver-mongo-otelmongo",
			// no version defaults to experimental
			wantStability: metadata.StabilityExperimental,
		},
		{
			req:      ContribRequire{Path: "go.opentelemetry.io/contrib/instrumentation/go.mongodb.org/mongo-driver/v2/mongo/otelmongo"},
			wantName: "instrumentation-go.mongodb.org-mongo-driver-v2-mongo-otelmongo",
		},
	}

	for _, tc := range cases {
		m := DeriveMetadata(tc.req)
		if m.Name != tc.wantName {
			t.Errorf("Name: got %q, want %q", m.Name, tc.wantName)
		}
		if m.InstrumentationType != tc.wantType {
			t.Errorf("%s InstrumentationType: got %v, want %v", tc.wantName, m.InstrumentationType, tc.wantType)
		}
		if m.Installation.Type != tc.wantInstall {
			t.Errorf("%s Installation.Type: got %v, want %v", tc.wantName, m.Installation.Type, tc.wantInstall)
		}
		if tc.wantTarget != "" && m.TargetModule != tc.wantTarget {
			t.Errorf("%s TargetModule: got %q, want %q", tc.wantName, m.TargetModule, tc.wantTarget)
		}
		if tc.wantSource != "" && m.SourcePath != tc.wantSource {
			t.Errorf("%s SourcePath: got %q, want %q", tc.wantName, m.SourcePath, tc.wantSource)
		}
		if tc.wantLibLink != "" && m.LibraryLink != tc.wantLibLink {
			t.Errorf("%s LibraryLink: got %q, want %q", tc.wantName, m.LibraryLink, tc.wantLibLink)
		}
		if m.Module.Path != tc.req.Path {
			t.Errorf("%s Module.Path: got %q, want %q", tc.wantName, m.Module.Path, tc.req.Path)
		}
		if m.Module.Version != tc.req.Version {
			t.Errorf("%s Module.Version: got %q, want %q", tc.wantName, m.Module.Version, tc.req.Version)
		}
	}
}

func TestMongoNameUniqueness(t *testing.T) {
	v1 := DeriveMetadata(ContribRequire{Path: "go.opentelemetry.io/contrib/instrumentation/go.mongodb.org/mongo-driver/mongo/otelmongo"})
	v2 := DeriveMetadata(ContribRequire{Path: "go.opentelemetry.io/contrib/instrumentation/go.mongodb.org/mongo-driver/v2/mongo/otelmongo"})

	if v1.Name == v2.Name {
		t.Errorf("otelmongo v1 and v2 have the same Name %q; names must be unique", v1.Name)
	}
	if v1.DisplayName != v2.DisplayName {
		t.Errorf("DisplayName differs: v1=%q v2=%q; display_name should be the same human-friendly leaf", v1.DisplayName, v2.DisplayName)
	}
}
