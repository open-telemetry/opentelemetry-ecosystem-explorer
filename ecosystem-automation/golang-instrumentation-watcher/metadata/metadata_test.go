package metadata

import (
	"os"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestRoundTrip(t *testing.T) {
	for _, path := range []string{
		"../instrumentation/otelhttp/metadata/otelhttp.yaml",
		"../instrumentation/otelhttp/metadata/otelslog.yaml",
	} {
		t.Run(path, func(t *testing.T) {
			data, err := os.ReadFile(path)
			if err != nil {
				t.Fatalf("read: %v", err)
			}
			var m Metadata
			if err := yaml.Unmarshal(data, &m); err != nil {
				t.Fatalf("unmarshal: %v", err)
			}
			if m.Name == "" {
				t.Error("name is empty")
			}
			if m.Module.Path == "" {
				t.Error("module.path is empty")
			}
			out, err := yaml.Marshal(m)
			if err != nil {
				t.Fatalf("marshal: %v", err)
			}
			var m2 Metadata
			if err := yaml.Unmarshal(out, &m2); err != nil {
				t.Fatalf("re-unmarshal: %v", err)
			}
			if m.Name != m2.Name || m.InstrumentationType != m2.InstrumentationType || m.Stability != m2.Stability {
				t.Errorf("round-trip mismatch: got %+v, want %+v", m2, m)
			}
		})
	}
}
