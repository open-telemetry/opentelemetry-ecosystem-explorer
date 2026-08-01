package conf

import (
	"os"
	"path/filepath"
	"testing"
)

func TestNewEnv(t *testing.T) {
	if NewEnv() == nil {
		t.Error("NewEnv() returned nil")
	}
}

func TestGetEnv(t *testing.T) {
	tests := []struct {
		name     string
		key      string
		setValue string
		fallback string
		want     string
	}{
		{"set variable", "TEST_VAR", "test_value", "fallback", "test_value"},
		{"unset variable", "NONEXISTENT_VAR", "", "fallback", "fallback"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.setValue != "" {
				_ = os.Setenv(tt.key, tt.setValue)
				defer func() { _ = os.Unsetenv(tt.key) }()
			}
			if got := NewEnv().GetEnv(tt.key, tt.fallback); got != tt.want {
				t.Errorf("GetEnv(%q) = %q, want %q", tt.key, got, tt.want)
			}
		})
	}

	t.Run("loads from .env file", func(t *testing.T) {
		tmpDir := t.TempDir()
		if err := os.WriteFile(filepath.Join(tmpDir, ".env"), []byte("TEST_ENV_VAR=from_file\n"), 0644); err != nil {
			t.Fatal(err)
		}
		orig, err := os.Getwd()
		if err != nil {
			t.Fatal(err)
		}
		defer func() { _ = os.Chdir(orig) }()
		if err := os.Chdir(tmpDir); err != nil {
			t.Fatal(err)
		}
		if got := NewEnv().GetEnv("TEST_ENV_VAR", "fallback"); got != "from_file" {
			t.Errorf("GetEnv() = %q, want from_file", got)
		}
	})
}

func TestWorkDir(t *testing.T) {
	dir, err := NewEnv().WorkDir()
	if err != nil {
		t.Fatalf("WorkDir() error = %v", err)
	}
	if !filepath.IsAbs(dir) {
		t.Errorf("WorkDir() = %q, want absolute path", dir)
	}
}

func TestLoad(t *testing.T) {
	tmpDir := t.TempDir()
	orig, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = os.Chdir(orig) }()
	if err := os.Chdir(tmpDir); err != nil {
		t.Fatal(err)
	}
	if err := NewEnv().Load(); err == nil {
		t.Error("Load() = nil, want error when .env is absent")
	}
}
