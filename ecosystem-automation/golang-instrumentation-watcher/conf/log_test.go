package conf

import (
	"context"
	"log/slog"
	"os"
	"testing"
)

func TestNewLog(t *testing.T) {
	t.Run("default level is info", func(t *testing.T) {
		log := NewLog()
		if log == nil || log.Logger == nil {
			t.Fatal("NewLog() returned nil")
		}
		ctx := context.Background()
		if log.Enabled(ctx, slog.LevelDebug) {
			t.Error("debug should not be enabled at the default Info level")
		}
		if !log.Enabled(ctx, slog.LevelInfo) {
			t.Error("info should be enabled at the default Info level")
		}
	})

	t.Run("LOG_LEVEL overrides level", func(t *testing.T) {
		_ = os.Setenv("LOG_LEVEL", "DEBUG")
		defer func() { _ = os.Unsetenv("LOG_LEVEL") }()
		log := NewLog()
		if !log.Enabled(context.Background(), slog.LevelDebug) {
			t.Error("debug should be enabled when LOG_LEVEL=DEBUG")
		}
	})
}

func TestNewLogWithLevel(t *testing.T) {
	tests := []struct {
		level   slog.Level
		wantOn  slog.Level
		wantOff slog.Level
	}{
		{slog.LevelDebug, slog.LevelDebug, slog.Level(slog.LevelDebug - 1)},
		{slog.LevelInfo, slog.LevelInfo, slog.LevelDebug},
		{slog.LevelWarn, slog.LevelWarn, slog.LevelInfo},
		{slog.LevelError, slog.LevelError, slog.LevelWarn},
	}
	for _, tt := range tests {
		t.Run(tt.level.String(), func(t *testing.T) {
			log := newLog(tt.level)
			if log == nil || log.Logger == nil {
				t.Fatal("newLog() returned nil")
			}
			ctx := context.Background()
			if !log.Enabled(ctx, tt.wantOn) {
				t.Errorf("level %v: %v should be enabled", tt.level, tt.wantOn)
			}
			if log.Enabled(ctx, tt.wantOff) {
				t.Errorf("level %v: %v should not be enabled", tt.level, tt.wantOff)
			}
		})
	}
}

func TestWithError(t *testing.T) {
	if NewLog().WithError(os.ErrNotExist) == nil {
		t.Error("WithError() returned nil")
	}
}

func TestWithErrorMsg(t *testing.T) {
	if NewLog().WithErrorMsg(os.ErrNotExist, "test error", "key", "value") == nil {
		t.Error("WithErrorMsg() returned nil")
	}
}
