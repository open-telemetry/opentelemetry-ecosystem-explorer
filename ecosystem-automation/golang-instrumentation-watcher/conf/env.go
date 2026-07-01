// Package conf provides environment and logging configuration for the watcher.
package conf

import (
	"os"

	"github.com/joho/godotenv"
)

// EnvConf resolves configuration from .env files and the OS environment.
//
// Construct an EnvConf with [NewEnv].
type EnvConf interface {
	// Load reads environment variables from the configured .env files, or from
	// the default .env file when none are configured.
	Load() error
	// GetEnv returns the value of env, or fallback when env is unset.
	GetEnv(env, fallback string) string
	// WorkDir returns the current working directory.
	WorkDir() (string, error)
}

// NewEnv returns an [EnvConf] that loads the given .env files, or the default
// .env file when none are given.
func NewEnv(files ...string) EnvConf {
	return &conf{
		files: files,
	}
}

type conf struct {
	loaded bool
	files  []string
}

func (c *conf) Load() error {
	if len(c.files) > 0 {
		return godotenv.Load(c.files...)
	}
	return godotenv.Load()
}

func (c *conf) GetEnv(env, fallback string) string {
	if !c.loaded {
		// throws error if .env file doesn't exist
		_ = c.Load()
		c.loaded = true
	}
	if value, ok := os.LookupEnv(env); ok {
		return value
	}
	return fallback
}

func (c *conf) WorkDir() (string, error) {
	return os.Getwd()
}
