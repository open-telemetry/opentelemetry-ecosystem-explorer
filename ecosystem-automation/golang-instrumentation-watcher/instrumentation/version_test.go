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
			Name:   "otelgin",
			Module: metadata.Module{Path: "go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin"},
		}},
		{Metadata: metadata.Metadata{
			Name:   "otelunknown",
			Module: metadata.Module{Path: "go.opentelemetry.io/contrib/instrumentation/example/otelunknown"},
		}},
	}
	versions := map[string]string{
		"instrumentation/github.com/gin-gonic/gin/otelgin": "v0.62.0",
	}

	ApplyModuleVersions(libs, versions)

	if libs[0].Module.Version != "v0.62.0" {
		t.Errorf("otelgin version = %q, want v0.62.0", libs[0].Module.Version)
	}
	if libs[1].Module.Version != "" {
		t.Errorf("otelunknown version = %q, want empty (no matching tag)", libs[1].Module.Version)
	}
}
