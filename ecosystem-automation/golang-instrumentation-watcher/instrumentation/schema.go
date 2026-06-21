package instrumentation

import (
	"gopkg.in/yaml.v3"
)

// SpanKind is the OpenTelemetry span kind of a [Span].
type SpanKind string

// The span kinds reported by [Span.Kind].
const (
	SpanKindServer   SpanKind = "server"
	SpanKindClient   SpanKind = "client"
	SpanKindProducer SpanKind = "producer"
	SpanKindConsumer SpanKind = "consumer"
	SpanKindInternal SpanKind = "internal"
)

// MetricType is the OpenTelemetry instrument kind of a [Metric].
type MetricType string

// The instrument kinds reported by [Metric.Type].
const (
	MetricTypeCounter       MetricType = "counter"
	MetricTypeHistogram     MetricType = "histogram"
	MetricTypeUpDownCounter MetricType = "updowncounter"
	MetricTypeGauge         MetricType = "gauge"
)

// AttributeType is the value type of an [Attribute].
type AttributeType string

// The value types reported by [Attribute.Type].
const (
	AttributeTypeString  AttributeType = "string"
	AttributeTypeLong    AttributeType = "int"
	AttributeTypeBoolean AttributeType = "boolean"
	AttributeTypeDouble  AttributeType = "double"
)

// Attribute is a single attribute emitted on a [Span] or [Metric].
type Attribute struct {
	ID       string        `yaml:"id,omitempty"`
	Ref      string        `yaml:"ref,omitempty"`
	Name     string        `yaml:"name,omitempty"`
	Type     AttributeType `yaml:"type,omitempty"`
	Examples []string      `yaml:"examples,omitempty"`
}

// Telemetry is the set of [Span] and [Metric] values produced under a single
// condition, identified by When.
type Telemetry struct {
	When    string   `yaml:"when,omitempty"`
	Spans   []Span   `yaml:"spans,omitempty"`
	Metrics []Metric `yaml:"metrics,omitempty"`
}

// Span is a span shape, identified by its [SpanKind] and the [Attribute] set it
// carries, emitted by a library.
type Span struct {
	Kind       SpanKind    `yaml:"kind,omitempty"`
	Attributes []Attribute `yaml:"attributes,omitempty"`
}

// Metric is a metric instrument, identified by its name and [MetricType],
// emitted by a library.
type Metric struct {
	Name       string      `yaml:"name"`
	Type       MetricType  `yaml:"type"`
	Unit       string      `yaml:"unit,omitempty"`
	Attributes []Attribute `yaml:"attributes,omitempty"`
}

// MarshalYAML implements [yaml.Marshaler], encoding the [Attribute] as a
// minimal name/type mapping.
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
