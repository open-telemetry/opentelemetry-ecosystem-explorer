package inventory

import (
	"crypto/sha256"
	"encoding/hex"
	"testing"
)

func TestContentHash(t *testing.T) {
	content := []byte("# Hello")

	got := ContentHash(content)

	full := sha256.Sum256(content)
	want := hex.EncodeToString(full[:])[:12]

	if got != want {
		t.Errorf("ContentHash() = %q, want %q", got, want)
	}
	if len(got) != 12 {
		t.Errorf("ContentHash() length = %d, want 12", len(got))
	}
}

func TestContentHashStable(t *testing.T) {
	if ContentHash([]byte("abc")) != ContentHash([]byte("abc")) {
		t.Error("ContentHash() is not stable for identical input")
	}
	if ContentHash([]byte("abc")) == ContentHash([]byte("abd")) {
		t.Error("ContentHash() collided for distinct input")
	}
}
