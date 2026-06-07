package conf

import (
	"log/slog"
	"os"
	"strconv"
)

const (
	ENV_LOG_LEVEL = "LOG_LEVEL"

	// defaults
	LOG_LEVEL_INFO = "info"
)

type Log struct {
	*slog.Logger
}

func NewLog() *Log {
	// default log level is info
	return newLog(slog.LevelInfo)
}

func newLog(level slog.Level) *Log {
	logLevel := level
	cfg := NewEnv()
	// override log level if set in env
	if envLevelStr := cfg.GetEnv(ENV_LOG_LEVEL, LOG_LEVEL_INFO); envLevelStr != "" {
		envLevel, err := strconv.Atoi(envLevelStr)
		if err == nil {
			logLevel = slog.Level(envLevel)
		}
	}
	opts := slog.HandlerOptions{
		Level: logLevel,
	}
	handler := slog.NewTextHandler(os.Stdout, &opts)
	logger := slog.New(handler)
	// set default logger
	slog.SetDefault(logger)
	return &Log{logger}
}

func (l *Log) WithError(err error) *Log {
	log := *l
	log.Logger = log.With("error", err)
	return &log
}

func (l *Log) WithErrorMsg(err error, msg string, args ...any) *Log {
	l.WithError(err).With(args...).Error(msg)
	return l
}
