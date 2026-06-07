package instrumentation

import (
	"log/slog"

	"gopkg.in/yaml.v3"
)

type SpanKind string

const (
	SpanKindServer   SpanKind = "server"
	SpanKindClient   SpanKind = "client"
	SpanKindProducer SpanKind = "producer"
	SpanKindConsumer SpanKind = "consumer"
	SpanKindInternal SpanKind = "internal"
)

type MetricType string

const (
	MetricTypeCounter       MetricType = "counter"
	MetricTypeHistogram     MetricType = "histogram"
	MetricTypeUpDownCounter MetricType = "updowncounter"
	MetricTypeGauge         MetricType = "gauge"
)

type AttributeType string

const (
	AttributeTypeString  AttributeType = "string"
	AttributeTypeLong    AttributeType = "int"
	AttributeTypeBoolean AttributeType = "boolean"
	AttributeTypeDouble  AttributeType = "double"
)

type Stability string

const (
	StabilityDevelopment  Stability = "development"
	StabilityExperimental Stability = "experimental"
	StabilityStable       Stability = "stable"
)

type Group struct {
	ID         string         `yaml:"id"`
	Type       string         `yaml:"type"`
	Name       string         `yaml:"display_name,omitempty"`
	Stability  Stability      `yaml:"stability"`
	Brief      string         `yaml:"brief"`
	SpanKind   SpanKind       `yaml:"span_kind,omitempty"`
	MetricName string         `yaml:"metric_name,omitempty"`
	Instrument MetricType     `yaml:"instrument,omitempty"`
	Unit       string         `yaml:"unit,omitempty"`
	Attributes []AttributeRef `yaml:"attributes,omitempty"`
}

type AttributeRef struct {
	Ref              string `yaml:"ref"`
	RequirementLevel string `yaml:"requirement_level,omitempty"`
}

type AttributeGroup struct {
	ID         string         `yaml:"id"`
	Type       string         `yaml:"type"`
	Name       string         `yaml:"display_name"`
	Brief      string         `yaml:"brief"`
	Attributes []AttributeDef `yaml:"attributes"`
}

type AttributeDef struct {
	ID        string        `yaml:"id"`
	Type      AttributeType `yaml:"type"`
	Brief     string        `yaml:"brief"`
	Stability Stability     `yaml:"stability,omitempty"`
	Examples  []interface{} `yaml:"examples,omitempty"`
}

type Attribute struct {
	ID        string        `yaml:"id,omitempty"`
	Ref       string        `yaml:"ref,omitempty"`
	Name      string        `yaml:"name,omitempty"`
	Type      AttributeType `yaml:"type,omitempty"`
	Stability Stability     `yaml:"stability,omitempty"`
	Examples  []string      `yaml:"examples,omitempty"`
}

type Telemetry struct {
	When    string   `yaml:"when,omitempty"`
	Spans   []Span   `yaml:"spans,omitempty"`
	Metrics []Metric `yaml:"metrics,omitempty"`
}

type Span struct {
	Kind       SpanKind    `yaml:"kind,omitempty"`
	Attributes []Attribute `yaml:"attributes,omitempty"`
}

type Metric struct {
	Name       string      `yaml:"name"`
	Type       MetricType  `yaml:"type"`
	Unit       string      `yaml:"unit,omitempty"`
	Attributes []Attribute `yaml:"attributes,omitempty"`
}

func (a Attribute) MarshalYAML() (interface{}, error) {
	node := &yaml.Node{
		Kind: yaml.MappingNode,
		Content: []*yaml.Node{
			{Kind: yaml.ScalarNode, Value: "name"},
			{Kind: yaml.ScalarNode, Value: a.Name},
			{Kind: yaml.ScalarNode, Value: "type"},
			{Kind: yaml.ScalarNode, Value: string(a.Type)},
		},
	}
	return node, nil
}

type Stats struct {
	LibrariesWithTelemetry           int
	LibrariesWithSemanticConventions int
	TotalSpans                       int
	TotalMetrics                     int
	TotalAttributes                  int
	SpansByKind                      map[SpanKind]int
	MetricsByType                    map[MetricType]int
}

func (s Stats) LogValue() slog.Value {
	return slog.GroupValue(
		slog.Int("libraries", s.LibrariesWithTelemetry),
		slog.Int("semconv", s.LibrariesWithSemanticConventions),
		slog.Int("spans", s.TotalSpans),
		slog.Int("metrics", s.TotalMetrics),
		slog.Int("attributes", s.TotalAttributes),
		slog.Int("server", s.SpansByKind[SpanKindServer]),
		slog.Int("client", s.SpansByKind[SpanKindClient]),
		slog.Int("internal", s.SpansByKind[SpanKindInternal]),
	)
}

func CalculateStats(groupsByRepo map[string][]Group) map[string]Stats {
	repoStats := make(map[string]Stats)

	for repoName, groups := range groupsByRepo {
		stats := Stats{
			SpansByKind:   make(map[SpanKind]int),
			MetricsByType: make(map[MetricType]int),
		}

		groupCount := make(map[string]bool)

		for _, group := range groups {
			groupCount[group.ID] = true

			if group.Type == "span" {
				stats.TotalSpans++
				if group.SpanKind != "" {
					stats.SpansByKind[group.SpanKind]++
				}
				stats.TotalAttributes += len(group.Attributes)
			}

			if group.Type == "metric" {
				stats.TotalMetrics++
				stats.TotalAttributes += len(group.Attributes)
			}
		}

		stats.LibrariesWithTelemetry = len(groupCount)

		repoStats[repoName] = stats
	}

	return repoStats
}
