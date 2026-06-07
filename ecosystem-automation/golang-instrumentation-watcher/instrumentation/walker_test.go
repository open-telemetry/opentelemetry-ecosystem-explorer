package instrumentation

import (
	"os"
	"path/filepath"
	"testing"
)

func TestWalk(t *testing.T) {
	t.Run("walker - finds all go.mod files", func(t *testing.T) {
		tmpDir := t.TempDir()

		dirs := []string{
			"github.com/gin-gonic/gin/otelgin",
			"google.golang.org/grpc/otelgrpc",
			"net/http/otelhttp",
		}

		for _, dir := range dirs {
			dirPath := filepath.Join(tmpDir, dir)
			if err := os.MkdirAll(dirPath, perms); err != nil {
				t.Fatal(err)
			}
			goModPath := filepath.Join(dirPath, "go.mod")
			if err := os.WriteFile(goModPath, []byte("module test"), 0644); err != nil {
				t.Fatal(err)
			}
		}

		packages, err := Walk(tmpDir)
		if err != nil {
			t.Fatalf("Walk() error = %v", err)
		}

		if len(packages) != 3 {
			t.Errorf("Walk() found %d packages, want 3", len(packages))
		}
	})

	t.Run("walker - excludes internal directories", func(t *testing.T) {
		tmpDir := t.TempDir()

		dirs := []string{
			"valid/package",
			"internal/helper",
			"test/fixtures",
			"example/demo",
		}

		for _, dir := range dirs {
			dirPath := filepath.Join(tmpDir, dir)
			if err := os.MkdirAll(dirPath, 0755); err != nil {
				t.Fatal(err)
			}
			goModPath := filepath.Join(dirPath, "go.mod")
			if err := os.WriteFile(goModPath, []byte("module test"), 0644); err != nil {
				t.Fatal(err)
			}
		}

		packages, err := Walk(tmpDir)
		if err != nil {
			t.Fatalf("Walk() error = %v", err)
		}

		if len(packages) != 1 {
			t.Errorf("Walk() found %d packages, want 1", len(packages))
		}

		if packages[0].Path != "valid/package" {
			t.Errorf("Walk() found package at %v, want valid/package", packages[0].Path)
		}
	})

	t.Run("walker - handles empty directory", func(t *testing.T) {
		tmpDir := t.TempDir()

		packages, err := Walk(tmpDir)
		if err != nil {
			t.Fatalf("Walk() error = %v", err)
		}

		if len(packages) != 0 {
			t.Errorf("Walk() found %d packages, want 0", len(packages))
		}
	})
}

func TestOmitDirectory(t *testing.T) {
	tests := []struct {
		name    string
		relPath string
		want    bool
	}{
		{
			name:    "omitDirectory - allows normal path",
			relPath: "github.com/gin-gonic/gin/otelgin",
			want:    false,
		},
		{
			name:    "omitDirectory - excludes internal",
			relPath: "github.com/gin-gonic/gin/internal/helper",
			want:    true,
		},
		{
			name:    "omitDirectory - excludes test",
			relPath: "github.com/gin-gonic/gin/test",
			want:    true,
		},
		{
			name:    "omitDirectory - excludes example",
			relPath: "github.com/gin-gonic/gin/example",
			want:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := omitDirectory(tt.relPath)
			if got != tt.want {
				t.Errorf("omitDirectory() = %v, want %v", got, tt.want)
			}
		})
	}
}
