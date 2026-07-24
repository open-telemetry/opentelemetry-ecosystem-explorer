package instrumentation

import (
	"os"
	"path/filepath"
	"slices"
	"testing"

	"github.com/open-telemetry/opentelemetry-ecosystem-explorer/golang-instrumentation-watcher/metadata"
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
	if err := os.WriteFile(filepath.Join(dir, "go.mod"), []byte(modFile(modulePath)), 0644); err != nil {
		t.Fatal(err)
	}
	pkgName := filepath.Base(modulePath)
	doc := "// Package " + pkgName + " is a test fixture.\npackage " + pkgName + "\n"
	if err := os.WriteFile(filepath.Join(dir, "doc.go"), []byte(doc), 0644); err != nil {
		t.Fatal(err)
	}
	return filepath.Join(dir, "go.mod")
}

// writeGoMod writes content as a go.mod under root/relDir, creating the dir.
func writeGoMod(t *testing.T, root, relDir, content string) {
	t.Helper()
	dir := filepath.Join(root, relDir)
	if err := os.MkdirAll(dir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "go.mod"), []byte(content), 0644); err != nil {
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
