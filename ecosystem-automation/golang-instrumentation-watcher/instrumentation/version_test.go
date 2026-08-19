package instrumentation

import (
	"testing"

	"github.com/open-telemetry/opentelemetry-ecosystem-explorer/golang-instrumentation-watcher/metadata"
)

func TestModuleVersions(t *testing.T) {
	tags := []string{
		"instrumentation/net/http/otelhttp/v0.62.0",
		"instrumentation/github.com/gin-gonic/gin/otelgin/v0.62.0",
		"v1.44.0", // bare repo-wide tag, ignored
	}

	got := ModuleVersions(tags)

	if got["instrumentation/net/http/otelhttp"] != "v0.62.0" {
		t.Errorf("otelhttp version = %q, want v0.62.0", got["instrumentation/net/http/otelhttp"])
	}
	if got["instrumentation/github.com/gin-gonic/gin/otelgin"] != "v0.62.0" {
		t.Errorf("otelgin version = %q, want v0.62.0", got["instrumentation/github.com/gin-gonic/gin/otelgin"])
	}
	if _, ok := got["v1.44.0"]; ok {
		t.Error("bare repo-wide tag should not appear in the version map")
	}
	if len(got) != 2 {
		t.Errorf("len(ModuleVersions) = %d, want 2", len(got))
	}
}

func TestApplyModuleVersions(t *testing.T) {
	libs := []Library{
		{Metadata: metadata.Metadata{
			Name:       "otelgin",
			SourcePath: "instrumentation/github.com/gin-gonic/gin/otelgin",
			Modules:    []metadata.Module{{Path: "go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin"}},
		}},
		{Metadata: metadata.Metadata{
			Name:       "otelunknown",
			SourcePath: "instrumentation/example/otelunknown",
			Modules:    []metadata.Module{{Path: "go.opentelemetry.io/contrib/instrumentation/example/otelunknown"}},
		}},
	}
	versions := map[string]string{
		"instrumentation/github.com/gin-gonic/gin/otelgin": "v0.62.0",
	}

	ApplyModuleVersions(libs, versions)

	if len(libs[0].Modules) == 0 || libs[0].Modules[0].Version != "v0.62.0" {
		t.Errorf("otelgin version = %v, want v0.62.0", libs[0].Modules)
	}
	if len(libs[1].Modules) == 0 || libs[1].Modules[0].Version != "" {
		t.Errorf("otelunknown version = %v, want empty (no matching tag)", libs[1].Modules)
	}
}

func TestApplyModuleVersions_StabilityInference(t *testing.T) {
	libs := []Library{
		{Metadata: metadata.Metadata{
			Name:       "stable-lib",
			SourcePath: "otelc/stable",
			Stability:  metadata.StabilityUnknown,
			Modules:    []metadata.Module{{Path: "go.opentelemetry.io/otelc/stable"}},
		}},
		{Metadata: metadata.Metadata{
			Name:       "experimental-lib",
			SourcePath: "otelc/experimental",
			Stability:  metadata.StabilityUnknown,
			Modules:    []metadata.Module{{Path: "go.opentelemetry.io/otelc/experimental"}},
		}},
		{Metadata: metadata.Metadata{
			Name:       "explicitly-stable-lib",
			SourcePath: "otelc/explicit",
			Stability:  metadata.StabilityStable, // Explicitly set to stable, should not be inferred
			Modules:    []metadata.Module{{Path: "go.opentelemetry.io/otelc/explicit"}},
		}},
	}
	versions := map[string]string{
		"otelc/stable":       "v1.0.0",
		"otelc/experimental": "v0.10.0",
		"otelc/explicit":     "v0.5.0",
	}

	ApplyModuleVersions(libs, versions)

	if libs[0].Stability != metadata.StabilityStable {
		t.Errorf("stable-lib stability = %v, want Stable", libs[0].Stability)
	}
	if libs[1].Stability != metadata.StabilityExperimental {
		t.Errorf("experimental-lib stability = %v, want Experimental", libs[1].Stability)
	}
	if libs[2].Stability != metadata.StabilityStable {
		t.Errorf("explicitly-stable-lib stability = %v, want Stable (should not be overwritten)", libs[2].Stability)
	}
}
