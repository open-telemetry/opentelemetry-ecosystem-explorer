package inventory

import (
	"os"
	"path/filepath"
	"testing"

	"gopkg.in/yaml.v3"

	"github.com/open-telemetry/opentelemetry-ecosystem-explorer/golang-instrumentation-watcher/instrumentation"
	"github.com/open-telemetry/opentelemetry-ecosystem-explorer/golang-instrumentation-watcher/metadata"
)

func lib(name string) instrumentation.Library {
	return instrumentation.Library{
		Metadata: metadata.Metadata{Name: name},
	}
}

func TestVersionDir(t *testing.T) {
	m := NewManager("/tmp/inv")
	tests := []struct {
		version string
		want    string
	}{
		{"v2.10.0", filepath.Join("/tmp/inv", "v2.10.0")},
		{"v2.11.0-SNAPSHOT", filepath.Join("/tmp/inv", "v2.11.0-SNAPSHOT")},
	}
	for _, tt := range tests {
		t.Run(tt.version, func(t *testing.T) {
			if got := m.VersionDir(tt.version); got != tt.want {
				t.Errorf("VersionDir(%q) = %q, want %q", tt.version, got, tt.want)
			}
		})
	}
}

func TestSaveAndLoad(t *testing.T) {
	m := NewManager(t.TempDir())

	if err := m.Save("v2.10.0", []instrumentation.Library{lib("otelgin"), lib("otelmux")}); err != nil {
		t.Fatalf("Save() error = %v", err)
	}

	path := filepath.Join(m.VersionDir("v2.10.0"), "instrumentation.yaml")
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("inventory file not written: %v", err)
	}

	var raw map[string]any
	data, _ := os.ReadFile(path)
	if err := yaml.Unmarshal(data, &raw); err != nil {
		t.Fatalf("Unmarshal() error = %v", err)
	}
	if raw["file_format"] != 0.1 {
		t.Errorf("file_format = %v, want 0.1", raw["file_format"])
	}
	if libs, ok := raw["libraries"].([]any); !ok || len(libs) != 2 {
		t.Fatalf("libraries = %v, want 2 entries", raw["libraries"])
	}

	loaded, err := m.Load("v2.10.0")
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if loaded.FileFormat != FileFormat {
		t.Errorf("loaded file_format = %v, want %v", loaded.FileFormat, FileFormat)
	}
	if len(loaded.Libraries) != 2 || loaded.Libraries[0].Name != "otelgin" {
		t.Errorf("loaded libraries = %+v", loaded.Libraries)
	}
}

func TestLoadNonexistent(t *testing.T) {
	m := NewManager(t.TempDir())
	loaded, err := m.Load("v2.10.0")
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if loaded.FileFormat != FileFormat {
		t.Errorf("file_format = %v, want %v", loaded.FileFormat, FileFormat)
	}
	if len(loaded.Libraries) != 0 {
		t.Errorf("libraries = %v, want empty", loaded.Libraries)
	}
}

func TestEmptyLibrariesMarshalsAsList(t *testing.T) {
	m := NewManager(t.TempDir())
	if err := m.Save("v0.1.0", nil); err != nil {
		t.Fatalf("Save() error = %v", err)
	}
	data, _ := os.ReadFile(filepath.Join(m.VersionDir("v0.1.0"), "instrumentation.yaml"))
	var raw map[string]any
	if err := yaml.Unmarshal(data, &raw); err != nil {
		t.Fatalf("Unmarshal() error = %v", err)
	}
	libs, ok := raw["libraries"]
	if !ok {
		t.Fatal("libraries key missing")
	}
	if libs != nil {
		if arr, ok := libs.([]any); !ok || len(arr) != 0 {
			t.Errorf("libraries = %v, want empty list", libs)
		}
	}
}

func saveVersions(t *testing.T, m *Manager, versions ...string) {
	t.Helper()
	for _, v := range versions {
		if err := m.Save(v, nil); err != nil {
			t.Fatalf("Save(%s) error = %v", v, err)
		}
	}
}

func TestListVersions(t *testing.T) {
	tests := []struct {
		name      string
		versions  []string
		extraDirs []string
		want      []string
	}{
		{
			name:     "sorted newest first",
			versions: []string{"v1.0.0", "v2.10.0", "v2.9.0", "v2.10.1", "v2.11.0-SNAPSHOT"},
			want:     []string{"v2.11.0-SNAPSHOT", "v2.10.1", "v2.10.0", "v2.9.0", "v1.0.0"},
		},
		{
			name: "empty inventory",
		},
		{
			name:      "skips invalid directories",
			versions:  []string{"v2.10.0"},
			extraDirs: []string{"not-a-version"},
			want:      []string{"v2.10.0"},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m := NewManager(t.TempDir())
			saveVersions(t, m, tt.versions...)
			for _, dir := range tt.extraDirs {
				if err := os.MkdirAll(m.VersionDir(dir), 0755); err != nil {
					t.Fatal(err)
				}
			}
			got, err := m.ListVersions()
			if err != nil {
				t.Fatalf("ListVersions() error = %v", err)
			}
			if len(got) != len(tt.want) {
				t.Fatalf("ListVersions() = %v, want %v", got, tt.want)
			}
			for i := range tt.want {
				if got[i] != tt.want[i] {
					t.Errorf("[%d] = %q, want %q", i, got[i], tt.want[i])
				}
			}
		})
	}
}

func TestListSnapshotVersions(t *testing.T) {
	m := NewManager(t.TempDir())
	saveVersions(t, m, "v2.9.0", "v2.10.0-SNAPSHOT", "v2.11.0-SNAPSHOT")

	got, err := m.ListSnapshotVersions()
	if err != nil {
		t.Fatalf("ListSnapshotVersions() error = %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("ListSnapshotVersions() = %v, want 2", got)
	}
	for _, v := range got {
		if !IsSnapshot(v) {
			t.Errorf("%q is not a snapshot", v)
		}
	}
}

func TestCleanupSnapshots(t *testing.T) {
	m := NewManager(t.TempDir())
	saveVersions(t, m, "v2.9.0", "v2.10.0-SNAPSHOT", "v2.11.0-SNAPSHOT")

	removed, err := m.CleanupSnapshots()
	if err != nil {
		t.Fatalf("CleanupSnapshots() error = %v", err)
	}
	if removed != 2 {
		t.Errorf("CleanupSnapshots() removed = %d, want 2", removed)
	}

	remaining, _ := m.ListVersions()
	if len(remaining) != 1 || remaining[0] != "v2.9.0" {
		t.Errorf("remaining = %v, want [v2.9.0]", remaining)
	}
}

func TestVersionExists(t *testing.T) {
	m := NewManager(t.TempDir())
	if m.VersionExists("v2.10.0") {
		t.Error("VersionExists() = true before save")
	}
	saveVersions(t, m, "v2.10.0")
	if !m.VersionExists("v2.10.0") {
		t.Error("VersionExists() = false after save")
	}
}

func TestVersionExistsRequiresFile(t *testing.T) {
	m := NewManager(t.TempDir())
	// A version directory with no instrumentation.yaml must not count as existing.
	if err := os.MkdirAll(m.VersionDir("v2.10.0"), 0755); err != nil {
		t.Fatal(err)
	}
	if m.VersionExists("v2.10.0") {
		t.Error("VersionExists() = true for dir without instrumentation.yaml")
	}
}

func TestInventoryYAMLValidation(t *testing.T) {
	m := NewManager(t.TempDir())

	libs := []instrumentation.Library{
		{
			Metadata: metadata.Metadata{Name: "otelfoo"},
			Telemetry: []instrumentation.Telemetry{
				{
					When: "default",
					Spans: []instrumentation.Span{
						{
							Kind: instrumentation.SpanKindServer,
							Attributes: []instrumentation.Attribute{
								{Name: "server.port", Type: instrumentation.AttributeTypeLong},
								{Name: "http.route", Type: instrumentation.AttributeTypeString},
							},
						},
						{
							Kind: instrumentation.SpanKindClient,
							Attributes: []instrumentation.Attribute{
								{Name: "url.full", Type: instrumentation.AttributeTypeString},
							},
						},
					},
					Metrics: []instrumentation.Metric{
						{
							Name: "http.server.request.duration",
							Type: instrumentation.MetricTypeHistogram,
							Unit: "s",
							Attributes: []instrumentation.Attribute{
								{Name: "http.request.method", Type: instrumentation.AttributeTypeString},
							},
						},
					},
				},
			},
		},
	}

	if err := m.Save("v1.0.0", libs); err != nil {
		t.Fatalf("Save() error = %v", err)
	}

	path := filepath.Join(m.VersionDir("v1.0.0"), "instrumentation.yaml")
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("ReadFile() error = %v", err)
	}

	var raw any
	if err := yaml.Unmarshal(data, &raw); err != nil {
		t.Fatalf("YAML is not valid: %v\n%s", err, data)
	}

	loaded, err := m.Load("v1.0.0")
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if len(loaded.Libraries) != 1 {
		t.Fatalf("libraries = %d, want 1", len(loaded.Libraries))
	}

	tel := loaded.Libraries[0].Telemetry[0]

	if len(tel.Spans) != 2 {
		t.Fatalf("spans = %d, want 2", len(tel.Spans))
	}
	for _, span := range tel.Spans {
		if span.Kind == "" {
			t.Error("span has empty kind")
		}
		for _, attr := range span.Attributes {
			if attr.Name == "" {
				t.Errorf("attribute in span %v has empty name", span.Kind)
			}
			if attr.Type == "" {
				t.Errorf("attribute %v in span %v has empty type", attr.Name, span.Kind)
			}
		}
	}

	if len(tel.Metrics) != 1 {
		t.Fatalf("metrics = %d, want 1", len(tel.Metrics))
	}
	if tel.Metrics[0].Name != "http.server.request.duration" {
		t.Errorf("metric name = %v, want http.server.request.duration", tel.Metrics[0].Name)
	}
	if tel.Metrics[0].Type != instrumentation.MetricTypeHistogram {
		t.Errorf("metric type = %v, want histogram", tel.Metrics[0].Type)
	}
	for _, attr := range tel.Metrics[0].Attributes {
		if attr.Name == "" {
			t.Error("metric attribute has empty name")
		}
		if attr.Type == "" {
			t.Errorf("metric attribute %v has empty type", attr.Name)
		}
	}
}

func TestDeleteVersion(t *testing.T) {
	m := NewManager(t.TempDir())
	saveVersions(t, m, "v2.10.0")

	deleted, err := m.DeleteVersion("v2.10.0")
	if err != nil || !deleted {
		t.Fatalf("DeleteVersion() = %v, %v; want true, nil", deleted, err)
	}
	if m.VersionExists("v2.10.0") {
		t.Error("version still exists after delete")
	}

	deleted, err = m.DeleteVersion("v2.10.0")
	if err != nil || deleted {
		t.Errorf("DeleteVersion(missing) = %v, %v; want false, nil", deleted, err)
	}
}
