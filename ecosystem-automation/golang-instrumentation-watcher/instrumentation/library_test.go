package instrumentation

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/open-telemetry/opentelemetry-ecosystem-explorer/golang-instrumentation-watcher/metadata"
)

func writeModule(t *testing.T, modulePath string) string {
	t.Helper()
	dir := t.TempDir()
	goMod := "module " + modulePath + "\n\ngo 1.24.0\n"
	if err := os.WriteFile(filepath.Join(dir, "go.mod"), []byte(goMod), 0644); err != nil {
		t.Fatal(err)
	}
	pkgName := filepath.Base(modulePath)
	doc := "// Package " + pkgName + " is a test fixture.\npackage " + pkgName + "\n"
	if err := os.WriteFile(filepath.Join(dir, "doc.go"), []byte(doc), 0644); err != nil {
		t.Fatal(err)
	}
	return filepath.Join(dir, "go.mod")
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
