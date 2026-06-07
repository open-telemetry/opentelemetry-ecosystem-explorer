package conf

import (
	"log/slog"
	"os"
	"testing"
)

func TestNewLog(t *testing.T) {
	t.Run("log - creates new Log with default level", func(t *testing.T) {
		log := NewLog()
		if log == nil {
			t.Error("NewLog() returned nil")
			return
		}
		if log.Logger == nil {
			t.Error("NewLog().Logger is nil")
		}
	})

	t.Run("log - respects LOG_LEVEL environment variable", func(t *testing.T) {
		_ = os.Setenv("LOG_LEVEL", "0")
		defer func() {
			_ = os.Unsetenv("LOG_LEVEL")
		}()

		log := NewLog()
		if log == nil {
			t.Error("NewLog() returned nil")
			return
		}
		if log.Logger == nil {
			t.Error("NewLog() Logger is nil")
		}
	})
}

func TestWithError(t *testing.T) {
	t.Run("log - WithError adds error to context", func(t *testing.T) {
		log := NewLog()
		testErr := os.ErrNotExist

		logWithErr := log.WithError(testErr)
		if logWithErr == nil {
			t.Error("WithError() returned nil")
		}
	})
}

func TestWithErrorMsg(t *testing.T) {
	t.Run("log - WithErrorMsg logs error with message", func(t *testing.T) {
		log := NewLog()
		testErr := os.ErrNotExist

		logWithErr := log.WithErrorMsg(testErr, "test error message", "key", "value")
		if logWithErr == nil {
			t.Error("WithErrorMsg() returned nil")
		}
	})
}

func TestNewLogWithLevel(t *testing.T) {
	tests := []struct {
		name  string
		level slog.Level
	}{
		{
			name:  "log - creates log with Debug level",
			level: slog.LevelDebug,
		},
		{
			name:  "log - creates log with Info level",
			level: slog.LevelInfo,
		},
		{
			name:  "log - creates log with Warn level",
			level: slog.LevelWarn,
		},
		{
			name:  "log - creates log with Error level",
			level: slog.LevelError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			log := newLog(tt.level)
			if log == nil {
				t.Error("newLog() returned nil")
				return
			}
			if log.Logger == nil {
				t.Error("newLog().Logger is nil")
			}
		})
	}
}
