package conf

import (
	"os"

	"github.com/joho/godotenv"
)

type EnvConf interface {
	// Loads env variables from .env files and/or OS environment
	Load() error
	// Resolve env variables or fallback
	GetEnv(env, fallback string) string
	// Resolve current working dir
	WorkDir() (string, error)
}

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
