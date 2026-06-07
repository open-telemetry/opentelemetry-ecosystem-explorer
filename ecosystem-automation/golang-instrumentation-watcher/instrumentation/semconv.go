package instrumentation

import (
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

// SemconvAttribute represents an attribute from the semantic conventions registry.
type SemconvAttribute struct {
	ID    string
	Brief string
	Type  string
}

// SemconvMetric represents a metric from the semantic conventions registry.
type SemconvMetric struct {
	Name string
}

// semconvRegistry holds loaded semantic convention attributes.
var semconvRegistry map[string]SemconvAttribute

// semconvMetrics holds loaded semantic convention metric names.
var semconvMetrics map[string]SemconvMetric

// LoadSemconv loads attribute and metric definitions from the semantic conventions registry.
func LoadSemconv(semconvPath string) error {
	semconvRegistry = make(map[string]SemconvAttribute)
	semconvMetrics = make(map[string]SemconvMetric)

	if _, err := os.Stat(semconvPath); os.IsNotExist(err) {
		return nil
	}

	var files []string
	err := filepath.Walk(semconvPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() && (strings.HasSuffix(path, ".yaml") || strings.HasSuffix(path, ".yml")) {
			files = append(files, path)
		}
		return nil
	})
	if err != nil {
		return err
	}

	for _, file := range files {
		if err := parseSemconvFile(file); err != nil {
			continue
		}
	}

	return nil
}

// parseAttributeType extracts the type from an attribute map.
func parseAttributeType(attrMap map[string]interface{}) string {
	if typeVal, ok := attrMap["type"].(string); ok {
		return typeVal
	}
	if typeMap, ok := attrMap["type"].(map[string]interface{}); ok {
		if members, hasMembers := typeMap["members"]; hasMembers && members != nil {
			return "string"
		}
	}
	return ""
}

// parseSemconvFile parses a single semantic convention YAML file.
func parseSemconvFile(filePath string) error {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return err
	}

	var doc struct {
		Groups []struct {
			ID         string                   `yaml:"id"`
			Type       string                   `yaml:"type"`
			MetricName string                   `yaml:"metric_name"`
			Attributes []map[string]interface{} `yaml:"attributes"`
		} `yaml:"groups"`
	}

	if err := yaml.Unmarshal(data, &doc); err != nil {
		return err
	}

	for _, group := range doc.Groups {
		if group.Type == "metric" && group.MetricName != "" {
			semconvMetrics[group.MetricName] = SemconvMetric{
				Name: group.MetricName,
			}
		}

		if group.Type != "attribute_group" {
			continue
		}

		for _, attrMap := range group.Attributes {
			id, _ := attrMap["id"].(string)
			if id == "" {
				continue
			}

			if ref, hasRef := attrMap["ref"].(string); hasRef && ref != "" {
				continue
			}

			brief, _ := attrMap["brief"].(string)
			attrType := parseAttributeType(attrMap)

			semconvRegistry[id] = SemconvAttribute{
				ID:    id,
				Brief: brief,
				Type:  mapSemconvType(attrType),
			}
		}
	}

	return nil
}

// mapSemconvType converts semconv types to our AttributeType format.
func mapSemconvType(semconvType string) string {
	switch strings.ToLower(semconvType) {
	case "string", "string[]":
		return "string"
	case "int", "int[]":
		return "int"
	case "double", "double[]":
		return "double"
	case "boolean", "boolean[]":
		return "boolean"
	default:
		return "string"
	}
}

// GetSemconvAttribute retrieves an attribute from the semconv registry.
func GetSemconvAttribute(id string) (SemconvAttribute, bool) {
	if semconvRegistry == nil {
		return SemconvAttribute{}, false
	}
	attr, ok := semconvRegistry[id]
	return attr, ok
}

// GetSemconvMetric retrieves a metric from the semconv registry.
func GetSemconvMetric(name string) (SemconvMetric, bool) {
	if semconvMetrics == nil {
		return SemconvMetric{}, false
	}
	metric, ok := semconvMetrics[name]
	return metric, ok
}
