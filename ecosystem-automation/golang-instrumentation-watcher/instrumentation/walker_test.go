package instrumentation

import (
	"os"
	"path/filepath"
	"testing"
)

func TestWalk(t *testing.T) {
	tests := []struct {
		name      string
		dirs      []string
		wantCount int
		wantPath  string // non-empty: assert packages[0].Path
	}{
		{
			name:      "finds all go.mod files",
			dirs:      []string{"github.com/gin-gonic/gin/otelgin", "google.golang.org/grpc/otelgrpc", "net/http/otelhttp"},
			wantCount: 3,
		},
		{
			name:      "excludes skipped directories",
			dirs:      []string{"valid/package", "internal/helper", "test/fixtures", "example/demo"},
			wantCount: 1,
			wantPath:  "valid/package",
		},
		{
			name:      "empty directory",
			wantCount: 0,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tmpDir := t.TempDir()
			for _, dir := range tt.dirs {
				dirPath := filepath.Join(tmpDir, dir)
				if err := os.MkdirAll(dirPath, 0755); err != nil {
					t.Fatal(err)
				}
				if err := os.WriteFile(filepath.Join(dirPath, "go.mod"), []byte("module test"), 0644); err != nil {
					t.Fatal(err)
				}
			}
			packages, err := Walk(tmpDir)
			if err != nil {
				t.Fatalf("Walk() error = %v", err)
			}
			if len(packages) != tt.wantCount {
				t.Fatalf("Walk() found %d packages, want %d", len(packages), tt.wantCount)
			}
			if tt.wantPath != "" && packages[0].Path != tt.wantPath {
				t.Errorf("packages[0].Path = %q, want %q", packages[0].Path, tt.wantPath)
			}
		})
	}
}
