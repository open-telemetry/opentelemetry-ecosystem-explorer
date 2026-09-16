package conf

import (
	"log/slog"
	"os"
	"strconv"
)

// ENV_LOG_LEVEL is the environment variable that overrides the log level.
const ENV_LOG_LEVEL = "LOG_LEVEL"

// Log is a [slog.Logger] extended with error-context helpers.
type Log struct {
	*slog.Logger
}

// NewLog returns a [Log] at the info level, overridden by [ENV_LOG_LEVEL] if set.
func NewLog() *Log {
	return newLog(slog.LevelInfo)
}

func newLog(level slog.Level) *Log {
	logLevel := level
	cfg := NewEnv()
	if envLevelStr := cfg.GetEnv(ENV_LOG_LEVEL, ""); envLevelStr != "" {
		var parsed slog.Level
		if err := parsed.UnmarshalText([]byte(envLevelStr)); err == nil {
			logLevel = parsed
		} else if envLevel, err := strconv.Atoi(envLevelStr); err == nil {
			logLevel = slog.Level(envLevel)
		}
	}
	opts := slog.HandlerOptions{
		Level: logLevel,
	}
	handler := slog.NewTextHandler(os.Stdout, &opts)
	logger := slog.New(handler)
	slog.SetDefault(logger)
	return &Log{logger}
}

// WithError returns a copy of the [Log] with err attached as an "error" attribute.
func (l *Log) WithError(err error) *Log {
	log := *l
	log.Logger = log.With("error", err)
	return &log
}

// WithErrorMsg logs msg at the error level with err and args attached, and
// returns the receiver for chaining.
func (l *Log) WithErrorMsg(err error, msg string, args ...any) *Log {
	l.WithError(err).With(args...).Error(msg)
	return l
}
