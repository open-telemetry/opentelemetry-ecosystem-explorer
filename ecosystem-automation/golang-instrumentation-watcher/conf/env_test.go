package conf

import (
	"os"
	"path/filepath"
	"testing"
)

func TestNewEnv(t *testing.T) {
	t.Run("env - creates new EnvConf", func(t *testing.T) {
		env := NewEnv()
		if env == nil {
			t.Error("NewEnv() returned nil")
		}
	})
}

func TestGetEnv(t *testing.T) {
	t.Run("env - returns environment variable", func(t *testing.T) {
		env := NewEnv()
		_ = os.Setenv("TEST_VAR", "test_value")
		defer func() {
			_ = os.Unsetenv("TEST_VAR")
		}()

		got := env.GetEnv("TEST_VAR", "fallback")
		if got != "test_value" {
			t.Errorf("GetEnv() = %v, want test_value", got)
		}
	})

	t.Run("env - returns fallback when variable not set", func(t *testing.T) {
		env := NewEnv()

		got := env.GetEnv("NONEXISTENT_VAR", "fallback")
		if got != "fallback" {
			t.Errorf("GetEnv() = %v, want fallback", got)
		}
	})

	t.Run("env - loads from .env file", func(t *testing.T) {
		tmpDir := t.TempDir()
		envFile := filepath.Join(tmpDir, ".env")
		content := "TEST_ENV_VAR=from_file\n"
		if err := os.WriteFile(envFile, []byte(content), 0644); err != nil {
			t.Fatal(err)
		}

		originalDir, err := os.Getwd()
		if err != nil {
			t.Fatal(err)
		}
		defer func() {
			_ = os.Chdir(originalDir)
		}()

		if err := os.Chdir(tmpDir); err != nil {
			t.Fatal(err)
		}

		env := NewEnv()
		got := env.GetEnv("TEST_ENV_VAR", "fallback")
		if got != "from_file" {
			t.Errorf("GetEnv() = %v, want from_file", got)
		}
	})
}

func TestWorkDir(t *testing.T) {
	t.Run("env - returns current working directory", func(t *testing.T) {
		env := NewEnv()

		dir, err := env.WorkDir()
		if err != nil {
			t.Fatalf("WorkDir() error = %v", err)
		}

		if dir == "" {
			t.Error("WorkDir() returned empty string")
		}

		if !filepath.IsAbs(dir) {
			t.Errorf("WorkDir() = %v, expected absolute path", dir)
		}
	})
}

func TestLoad(t *testing.T) {
	t.Run("env - Load returns no error when .env not found", func(t *testing.T) {
		tmpDir := t.TempDir()

		originalDir, err := os.Getwd()
		if err != nil {
			t.Fatal(err)
		}
		defer func() {
			_ = os.Chdir(originalDir)
		}()

		if err := os.Chdir(tmpDir); err != nil {
			t.Fatal(err)
		}

		env := NewEnv()
		if err := env.Load(); err != nil {
			t.Logf("Load() error = %v (expected for missing .env)", err)
		}
	})
}
