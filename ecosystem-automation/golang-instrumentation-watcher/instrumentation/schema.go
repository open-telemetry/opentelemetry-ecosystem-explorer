package instrumentation

import (
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

type Attribute struct {
	ID       string        `yaml:"id,omitempty"`
	Ref      string        `yaml:"ref,omitempty"`
	Name     string        `yaml:"name,omitempty"`
	Type     AttributeType `yaml:"type,omitempty"`
	Examples []string      `yaml:"examples,omitempty"`
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

