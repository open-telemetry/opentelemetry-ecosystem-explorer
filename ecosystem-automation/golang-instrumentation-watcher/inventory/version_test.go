package inventory

import "testing"

func TestIsValidVersion(t *testing.T) {
	cases := map[string]bool{
		"v0.1.0":           true,
		"v2.11.0-SNAPSHOT": true,
		"v1.2.3":           true,
		"not-a-version":    false,
		"0.1.0":            false, // semver requires the leading "v"
	}
	for name, want := range cases {
		if got := IsValidVersion(name); got != want {
			t.Errorf("IsValidVersion(%q) = %v, want %v", name, got, want)
		}
	}
}

func TestIsSnapshot(t *testing.T) {
	if !IsSnapshot("v0.1.0-SNAPSHOT") {
		t.Error("IsSnapshot(snapshot) = false")
	}
	if IsSnapshot("v0.1.0") {
		t.Error("IsSnapshot(release) = true")
	}
}

func TestNextSnapshot(t *testing.T) {
	cases := map[string]string{
		"v0.5.2":  "v0.5.3-SNAPSHOT",
		"v1.0.0":  "v1.0.1-SNAPSHOT",
		"v2.10.9": "v2.10.10-SNAPSHOT",
	}
	for in, want := range cases {
		got, err := NextSnapshot(in)
		if err != nil {
			t.Errorf("NextSnapshot(%q) error = %v", in, err)
			continue
		}
		if got != want {
			t.Errorf("NextSnapshot(%q) = %q, want %q", in, got, want)
		}
	}

	if _, err := NextSnapshot("not-a-version"); err == nil {
		t.Error("NextSnapshot(invalid) = nil error, want error")
	}
}
