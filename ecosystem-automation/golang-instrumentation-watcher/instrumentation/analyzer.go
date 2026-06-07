package instrumentation

import (
	"fmt"
	"go/ast"
	"strings"

	"golang.org/x/tools/go/packages"
)

// AnalyzePackage performs static analysis on an instrumentation package.
func AnalyzePackage(pkgPath string) (*PackageAnalysis, error) {
	cfg := &packages.Config{
		Mode: packages.NeedName |
			packages.NeedFiles |
			packages.NeedCompiledGoFiles |
			packages.NeedImports |
			packages.NeedTypes |
			packages.NeedSyntax |
			packages.NeedTypesInfo,
		Dir: pkgPath,
	}

	pkgs, err := packages.Load(cfg, ".")
	if err != nil {
		return nil, err
	}

	if len(pkgs) == 0 {
		return nil, nil
	}

	pkg := pkgs[0]
	analysis := &PackageAnalysis{
		Name: pkg.Name,
	}

	// Extract package documentation
	for _, file := range pkg.Syntax {
		if file.Doc != nil && file.Doc.Text() != "" {
			analysis.Description = strings.TrimSpace(file.Doc.Text())
			break
		}
	}

	// Extract semantic conventions from imports
	rawConventions := extractSemanticConventions(pkg)
	analysis.SemanticConventions = mapSemanticConventions(rawConventions, pkg.PkgPath)

	// Extract telemetry (spans, metrics) from tracer/meter usage
	analysis.Telemetry = extractTelemetry(pkg)
	analysis.Groups = convertTelemetryToGroups(pkg.PkgPath, analysis.Telemetry)

	return analysis, nil
}

type PackageAnalysis struct {
	Name                string
	Description         string
	SemanticConventions []string
	Telemetry           []Telemetry
	Groups              []Group
}

func extractSemanticConventions(pkg *packages.Package) []string {
	var conventions []string
	seen := make(map[string]bool)

	for _, imp := range pkg.Imports {
		// Look for semconv imports
		if strings.Contains(imp.PkgPath, "semconv") {
			if !seen[imp.PkgPath] {
				conventions = append(conventions, imp.PkgPath)
				seen[imp.PkgPath] = true
			}
		}
	}

	return conventions
}

func mapSemanticConventions(rawConventions []string, pkgPath string) []string {
	var mapped []string
	seen := make(map[string]bool)

	for _, raw := range rawConventions {
		conventions := inferConventionsFromImport(raw, pkgPath)
		for _, conv := range conventions {
			if !seen[conv] {
				mapped = append(mapped, conv)
				seen[conv] = true
			}
		}
	}

	if len(mapped) == 0 {
		return rawConventions
	}

	return mapped
}

func inferConventionsFromImport(importPath string, pkgPath string) []string {
	var conventions []string

	pkgLower := strings.ToLower(pkgPath)

	if strings.Contains(pkgLower, "http") ||
		strings.Contains(pkgLower, "gin") ||
		strings.Contains(pkgLower, "echo") ||
		strings.Contains(pkgLower, "mux") ||
		strings.Contains(pkgLower, "restful") {
		if strings.Contains(pkgPath, "otelhttp") || strings.Contains(pkgPath, "httptrace") {
			conventions = append(conventions, "HTTP_CLIENT_SPANS")
		} else {
			conventions = append(conventions, "HTTP_SERVER_SPANS")
		}
		conventions = append(conventions, "HTTP_SERVER_METRICS")
	}

	if strings.Contains(pkgLower, "grpc") {
		conventions = append(conventions, "RPC_SERVER_SPANS")
		conventions = append(conventions, "RPC_CLIENT_SPANS")
	}

	if strings.Contains(pkgLower, "mongo") || strings.Contains(pkgLower, "database") || strings.Contains(pkgLower, "sql") {
		conventions = append(conventions, "DATABASE_CLIENT_SPANS")
	}

	if strings.Contains(pkgLower, "kafka") || strings.Contains(pkgLower, "messaging") {
		conventions = append(conventions, "MESSAGING_CLIENT_SPANS")
	}

	if strings.Contains(pkgLower, "aws") || strings.Contains(pkgLower, "lambda") {
		conventions = append(conventions, "FAAS_SPANS")
	}

	if len(conventions) == 0 {
		return []string{importPath}
	}

	return conventions
}

func extractTelemetry(pkg *packages.Package) []Telemetry {
	spans := extractSpans(pkg)
	metrics := extractMetrics(pkg)

	if len(spans) == 0 && len(metrics) == 0 {
		return nil
	}

	return []Telemetry{{
		When:    "default",
		Spans:   spans,
		Metrics: metrics,
	}}
}

func isTracerStart(callExpr *ast.CallExpr, pkg *packages.Package) bool {
	if len(callExpr.Args) < 1 {
		return false
	}

	firstArgType := pkg.TypesInfo.TypeOf(callExpr.Args[0])
	if firstArgType == nil {
		return false
	}

	typeStr := firstArgType.String()
	return strings.Contains(typeStr, "context.Context")
}

func extractSpans(pkg *packages.Package) []Span {
	spanMap := make(map[SpanKind]*Span)
	startCallCount := 0

	detectedKinds := detectSpanKindsInPackage(pkg)

	for _, file := range pkg.Syntax {
		ast.Inspect(file, func(n ast.Node) bool {
			callExpr, ok := n.(*ast.CallExpr)
			if !ok {
				return true
			}

			selExpr, ok := callExpr.Fun.(*ast.SelectorExpr)
			if !ok {
				return true
			}

			if selExpr.Sel.Name == "Start" && len(callExpr.Args) >= 2 && isTracerStart(callExpr, pkg) {
				extractSpanFromStart(callExpr, spanMap, pkg.PkgPath, detectedKinds)
				startCallCount++
			}

			if selExpr.Sel.Name == "SetAttributes" {
				extractSpanSetAttributes(callExpr, spanMap, detectedKinds)
			}

			if selExpr.Sel.Name == "AddEvent" {
				extractSpanAddEvent(callExpr, spanMap, detectedKinds)
			}

			return true
		})
	}

	if startCallCount > 0 && len(spanMap) == 0 && len(detectedKinds) > 0 {
		for kind := range detectedKinds {
			spanMap[kind] = &Span{
				Kind:       kind,
				Attributes: getSemConvAttributesForSpan(kind, pkg.PkgPath),
			}
		}
	}

	var spans []Span
	for _, span := range spanMap {
		spans = append(spans, *span)
	}

	return spans
}

func detectSpanKindsInPackage(pkg *packages.Package) map[SpanKind]bool {
	kinds := make(map[SpanKind]bool)

	for _, file := range pkg.Syntax {
		ast.Inspect(file, func(n ast.Node) bool {
			selExpr, ok := n.(*ast.SelectorExpr)
			if !ok {
				return true
			}

			for _, kind := range []SpanKind{
				SpanKindServer,
				SpanKindClient,
				SpanKindProducer,
				SpanKindConsumer,
			} {
				if hasKind(selExpr.Sel.Name, kind) {
					kinds[kind] = true
				}
			}
			return true
		})
	}

	return kinds
}

func hasKind(kindName string, kind SpanKind) bool {
	kindStr := strings.ToLower(string(kind))
	nameStr := strings.ToLower(kindName)
	return strings.Contains(nameStr, kindStr)
}

func extractSpanFromStart(callExpr *ast.CallExpr, spanMap map[SpanKind]*Span, pkgPath string, detectedKinds map[SpanKind]bool) {
	var spanKind SpanKind
	var attributes []Attribute

	if len(callExpr.Args) >= 3 {
		for i := 2; i < len(callExpr.Args); i++ {
			kind, attrs := parseSpanStartOption(callExpr.Args[i])
			if kind != "" {
				spanKind = kind
			}
			attributes = append(attributes, attrs...)
		}
	}

	if spanKind == "" {
		if detectedKinds[SpanKindServer] {
			spanKind = SpanKindServer
		} else if detectedKinds[SpanKindClient] {
			spanKind = SpanKindClient
		} else if detectedKinds[SpanKindProducer] {
			spanKind = SpanKindProducer
		} else if detectedKinds[SpanKindConsumer] {
			spanKind = SpanKindConsumer
		} else {
			spanKind = SpanKindInternal
		}
	}

	if _, exists := spanMap[spanKind]; !exists {
		spanMap[spanKind] = &Span{
			Kind:       spanKind,
			Attributes: getSemConvAttributesForSpan(spanKind, pkgPath),
		}
	}

	attrMap := make(map[string]bool)
	for _, attr := range spanMap[spanKind].Attributes {
		attrMap[attr.Name] = true
	}

	for _, attr := range attributes {
		if !attrMap[attr.Name] {
			spanMap[spanKind].Attributes = append(spanMap[spanKind].Attributes, attr)
			attrMap[attr.Name] = true
		}
	}
}

func parseSpanStartOption(expr ast.Expr) (SpanKind, []Attribute) {
	callExpr, ok := expr.(*ast.CallExpr)
	if !ok {
		return "", nil
	}

	selExpr, ok := callExpr.Fun.(*ast.SelectorExpr)
	if !ok {
		return "", nil
	}

	if selExpr.Sel.Name == "WithSpanKind" && len(callExpr.Args) > 0 {
		kind := extractSpanKind(callExpr.Args[0])
		return kind, nil
	}

	if selExpr.Sel.Name == "WithAttributes" {
		attrs := extractAttributes(callExpr.Args)
		return "", attrs
	}

	return "", nil
}

func extractSpanKind(expr ast.Expr) SpanKind {
	selExpr, ok := expr.(*ast.SelectorExpr)
	if !ok {
		return ""
	}

	kindName := strings.ToLower(selExpr.Sel.Name)
	switch {
	case strings.Contains(kindName, string(SpanKindServer)):
		return SpanKindServer
	case strings.Contains(kindName, string(SpanKindClient)):
		return SpanKindClient
	case strings.Contains(kindName, string(SpanKindProducer)):
		return SpanKindProducer
	case strings.Contains(kindName, string(SpanKindConsumer)):
		return SpanKindConsumer
	default:
		return SpanKindInternal
	}
}

func extractAttributes(args []ast.Expr) []Attribute {
	var attributes []Attribute

	for _, arg := range args {
		attr := parseAttributeExpr(arg)
		if attr.Name != "" {
			attributes = append(attributes, attr)
		}
	}

	return attributes
}

func parseAttributeExpr(expr ast.Expr) Attribute {
	callExpr, ok := expr.(*ast.CallExpr)
	if !ok {
		return Attribute{}
	}

	selExpr, ok := callExpr.Fun.(*ast.SelectorExpr)
	if !ok {
		return Attribute{}
	}

	if len(callExpr.Args) < 2 {
		return Attribute{}
	}

	keyLit, ok := callExpr.Args[0].(*ast.BasicLit)
	if !ok {
		return Attribute{}
	}

	attrName := strings.Trim(keyLit.Value, `"`)
	attrType := getAttributeType(selExpr.Sel.Name)

	return Attribute{
		Name: attrName,
		Type: attrType,
	}
}

func getAttributeType(funcName string) AttributeType {
	switch {
	case strings.Contains(funcName, "String"):
		return AttributeTypeString
	case strings.Contains(funcName, "Int64"), strings.Contains(funcName, "Int"):
		return AttributeTypeLong
	case strings.Contains(funcName, "Bool"):
		return AttributeTypeBoolean
	case strings.Contains(funcName, "Float64"), strings.Contains(funcName, "Float"):
		return AttributeTypeDouble
	default:
		return AttributeTypeString
	}
}

func extractSpanSetAttributes(callExpr *ast.CallExpr, spanMap map[SpanKind]*Span, detectedKinds map[SpanKind]bool) {
	attributes := extractAttributes(callExpr.Args)
	if len(attributes) == 0 {
		return
	}

	if len(spanMap) == 0 {
		for kind := range detectedKinds {
			if _, exists := spanMap[kind]; !exists {
				spanMap[kind] = &Span{
					Kind:       kind,
					Attributes: []Attribute{},
				}
			}
		}
		if len(spanMap) == 0 {
			spanMap[SpanKindInternal] = &Span{
				Kind:       SpanKindInternal,
				Attributes: []Attribute{},
			}
		}
	}

	for _, span := range spanMap {
		attrMap := make(map[string]bool)
		for _, attr := range span.Attributes {
			attrMap[attr.Name] = true
		}

		for _, attr := range attributes {
			if !attrMap[attr.Name] {
				span.Attributes = append(span.Attributes, attr)
				attrMap[attr.Name] = true
			}
		}
	}
}

func extractSpanAddEvent(callExpr *ast.CallExpr, spanMap map[SpanKind]*Span, detectedKinds map[SpanKind]bool) {
	if len(callExpr.Args) < 2 {
		return
	}

	for i := 1; i < len(callExpr.Args); i++ {
		if innerCall, ok := callExpr.Args[i].(*ast.CallExpr); ok {
			if selExpr, ok := innerCall.Fun.(*ast.SelectorExpr); ok && selExpr.Sel.Name == "WithAttributes" {
				extractSpanSetAttributes(innerCall, spanMap, detectedKinds)
			}
		}
	}
}

func extractMetrics(pkg *packages.Package) []Metric {
	metricMap := make(map[string]*Metric)

	// First, look for explicitly created metrics in the code
	for _, file := range pkg.Syntax {
		ast.Inspect(file, func(n ast.Node) bool {
			callExpr, ok := n.(*ast.CallExpr)
			if !ok {
				return true
			}

			selExpr, ok := callExpr.Fun.(*ast.SelectorExpr)
			if !ok {
				return true
			}

			methodName := selExpr.Sel.Name
			metricType := mapMetricType(methodName)

			if metricType == "" || len(callExpr.Args) == 0 {
				return true
			}

			if lit, ok := callExpr.Args[0].(*ast.BasicLit); ok {
				metricName := strings.Trim(lit.Value, `"`)
				if _, exists := metricMap[metricName]; !exists {
					unit := extractMetricUnit(callExpr)
					metricMap[metricName] = &Metric{
						Name: metricName,
						Type: metricType,
						Unit: unit,
					}
				}
			}

			return true
		})
	}

	// Add semantic convention metrics based on package type
	semconvMetrics := getSemConvMetrics(pkg.PkgPath)
	for _, metric := range semconvMetrics {
		if _, exists := metricMap[metric.Name]; !exists {
			metricMap[metric.Name] = &metric
		}
	}

	var metrics []Metric
	for _, metric := range metricMap {
		metrics = append(metrics, *metric)
	}

	return metrics
}

func mapMetricType(methodName string) MetricType {
	lowerName := strings.ToLower(methodName)
	switch {
	case strings.Contains(lowerName, string(MetricTypeCounter)) && !strings.Contains(lowerName, "updown"):
		return MetricTypeCounter
	case strings.Contains(lowerName, string(MetricTypeHistogram)):
		return MetricTypeHistogram
	case strings.Contains(lowerName, string(MetricTypeUpDownCounter)):
		return MetricTypeUpDownCounter
	case strings.Contains(lowerName, string(MetricTypeGauge)):
		return MetricTypeGauge
	default:
		return ""
	}
}

func extractMetricUnit(callExpr *ast.CallExpr) string {
	if len(callExpr.Args) < 2 {
		return ""
	}

	for i := 1; i < len(callExpr.Args); i++ {
		optCall, ok := callExpr.Args[i].(*ast.CallExpr)
		if !ok {
			continue
		}

		selExpr, ok := optCall.Fun.(*ast.SelectorExpr)
		if !ok {
			continue
		}

		if selExpr.Sel.Name == "WithUnit" && len(optCall.Args) > 0 {
			if lit, ok := optCall.Args[0].(*ast.BasicLit); ok {
				return strings.Trim(lit.Value, `"`)
			}
		}
	}

	return ""
}

func getSemConvAttributesForSpan(spanKind SpanKind, pkgPath string) []Attribute {
	pkgLower := strings.ToLower(pkgPath)

	if spanKind == SpanKindServer && isHTTPPackage(pkgLower) {
		return []Attribute{
			{Name: "http.request.method", Type: AttributeTypeString},
			{Name: "http.response.status_code", Type: AttributeTypeLong},
			{Name: "http.route", Type: AttributeTypeString},
			{Name: "server.address", Type: AttributeTypeString},
			{Name: "server.port", Type: AttributeTypeLong},
			{Name: "url.scheme", Type: AttributeTypeString},
			{Name: "url.path", Type: AttributeTypeString},
			{Name: "network.protocol.name", Type: AttributeTypeString},
			{Name: "network.protocol.version", Type: AttributeTypeString},
			{Name: "user_agent.original", Type: AttributeTypeString},
			{Name: "client.address", Type: AttributeTypeString},
			{Name: "network.peer.address", Type: AttributeTypeString},
		}
	}

	if spanKind == SpanKindClient && isHTTPPackage(pkgLower) {
		return []Attribute{
			{Name: "http.request.method", Type: AttributeTypeString},
			{Name: "http.response.status_code", Type: AttributeTypeLong},
			{Name: "server.address", Type: AttributeTypeString},
			{Name: "server.port", Type: AttributeTypeLong},
			{Name: "url.full", Type: AttributeTypeString},
			{Name: "network.protocol.name", Type: AttributeTypeString},
			{Name: "network.protocol.version", Type: AttributeTypeString},
		}
	}

	if spanKind == SpanKindClient && isDatabasePackage(pkgLower) {
		return []Attribute{
			{Name: "db.system", Type: AttributeTypeString},
			{Name: "db.operation.name", Type: AttributeTypeString},
			{Name: "db.collection.name", Type: AttributeTypeString},
			{Name: "db.query.text", Type: AttributeTypeString},
			{Name: "server.address", Type: AttributeTypeString},
			{Name: "server.port", Type: AttributeTypeLong},
		}
	}

	if (spanKind == SpanKindServer || spanKind == SpanKindClient) && isRPCPackage(pkgLower) {
		return []Attribute{
			{Name: "rpc.system", Type: AttributeTypeString},
			{Name: "rpc.service", Type: AttributeTypeString},
			{Name: "rpc.method", Type: AttributeTypeString},
			{Name: "server.address", Type: AttributeTypeString},
			{Name: "server.port", Type: AttributeTypeLong},
		}
	}

	if spanKind == SpanKindServer && isLambdaPackage(pkgLower) {
		return []Attribute{
			{Name: "faas.invocation_id", Type: AttributeTypeString},
			{Name: "cloud.resource_id", Type: AttributeTypeString},
		}
	}

	if spanKind == SpanKindClient && isAWSPackage(pkgLower) {
		return []Attribute{
			{Name: "rpc.system", Type: AttributeTypeString},
			{Name: "rpc.service", Type: AttributeTypeString},
			{Name: "rpc.method", Type: AttributeTypeString},
			{Name: "server.address", Type: AttributeTypeString},
			{Name: "server.port", Type: AttributeTypeLong},
		}
	}

	return nil
}

func isAWSPackage(pkgPath string) bool {
	return strings.Contains(pkgPath, "aws")
}

func isHTTPPackage(pkgPath string) bool {
	return strings.Contains(pkgPath, "http") ||
		strings.Contains(pkgPath, "gin") ||
		strings.Contains(pkgPath, "echo") ||
		strings.Contains(pkgPath, "mux") ||
		strings.Contains(pkgPath, "restful")
}

func isDatabasePackage(pkgPath string) bool {
	return strings.Contains(pkgPath, "mongo") ||
		strings.Contains(pkgPath, "database") ||
		strings.Contains(pkgPath, "sql")
}

func isRPCPackage(pkgPath string) bool {
	return strings.Contains(pkgPath, "grpc")
}

func isLambdaPackage(pkgPath string) bool {
	return strings.Contains(pkgPath, "lambda")
}

func isRuntimePackage(pkgPath string) bool {
	return strings.HasSuffix(pkgPath, "/instrumentation/runtime")
}

func isHostPackage(pkgPath string) bool {
	return strings.HasSuffix(pkgPath, "/instrumentation/host")
}

func makeSpanGroupID(pkgName string, kind SpanKind) string {
	return fmt.Sprintf("%s.%s.span", pkgName, strings.ToLower(string(kind)))
}

func makeMetricGroupID(pkgName, metricName string) string {
	return fmt.Sprintf("%s.metric.%s", pkgName, sanitizeMetricName(metricName))
}

func convertTelemetryToGroups(pkgPath string, telemetry []Telemetry) []Group {
	groupMap := make(map[string]*Group)
	pkgName := sanitizePackageName(pkgPath)

	for _, tel := range telemetry {
		for _, span := range tel.Spans {
			attrs := convertAttributesToRefs(span.Attributes)
			if len(attrs) == 0 {
				continue
			}

			groupID := makeSpanGroupID(pkgName, span.Kind)
			if existing, ok := groupMap[groupID]; ok {
				attrMap := make(map[string]bool)
				for _, attr := range existing.Attributes {
					attrMap[attr.Ref] = true
				}
				for _, attr := range attrs {
					if !attrMap[attr.Ref] {
						existing.Attributes = append(existing.Attributes, attr)
					}
				}
			} else {
				groupMap[groupID] = &Group{
					ID:         groupID,
					Type:       "span",
					Name:       pkgName + " " + strings.ToLower(string(span.Kind)) + " span",
					Stability:  StabilityDevelopment,
					Brief:      "Span for " + pkgName,
					SpanKind:   span.Kind,
					Attributes: attrs,
				}
			}
		}

		for _, metric := range tel.Metrics {
			if _, ok := GetSemconvMetric(metric.Name); ok {
				continue
			}

			groupID := makeMetricGroupID(pkgName, metric.Name)
			if _, ok := groupMap[groupID]; !ok {
				groupMap[groupID] = &Group{
					ID:         groupID,
					Type:       "metric",
					MetricName: metric.Name,
					Instrument: metric.Type,
					Unit:       metric.Unit,
					Stability:  StabilityDevelopment,
					Brief:      "Metric " + metric.Name,
					Attributes: convertAttributesToRefs(metric.Attributes),
				}
			}
		}
	}

	var groups []Group
	for _, group := range groupMap {
		groups = append(groups, *group)
	}

	return groups
}

func convertAttributesToRefs(attrs []Attribute) []AttributeRef {
	var refs []AttributeRef
	for _, attr := range attrs {
		refs = append(refs, AttributeRef{
			Ref:              attr.Name,
			RequirementLevel: "recommended",
		})
	}
	return refs
}

func sanitizePackageName(pkgPath string) string {
	parts := strings.Split(pkgPath, "/")
	name := parts[len(parts)-1]
	return strings.TrimPrefix(name, "otel")
}

func sanitizeMetricName(metricName string) string {
	return strings.ReplaceAll(metricName, ".", "_")
}

func getSemConvMetrics(pkgPath string) []Metric {
	pkgLower := strings.ToLower(pkgPath)

	if isHTTPPackage(pkgLower) {
		return []Metric{
			{
				Name: "http.server.request.duration",
				Type: MetricTypeHistogram,
				Unit: "s",
				Attributes: []Attribute{
					{Name: "http.request.method", Type: AttributeTypeString},
					{Name: "http.response.status_code", Type: AttributeTypeLong},
					{Name: "http.route", Type: AttributeTypeString},
					{Name: "network.protocol.version", Type: AttributeTypeString},
					{Name: "url.scheme", Type: AttributeTypeString},
				},
			},
			{
				Name: "http.server.request.body.size",
				Type: MetricTypeHistogram,
				Unit: "By",
				Attributes: []Attribute{
					{Name: "http.request.method", Type: AttributeTypeString},
					{Name: "http.response.status_code", Type: AttributeTypeLong},
					{Name: "http.route", Type: AttributeTypeString},
					{Name: "network.protocol.version", Type: AttributeTypeString},
					{Name: "url.scheme", Type: AttributeTypeString},
				},
			},
			{
				Name: "http.server.response.body.size",
				Type: MetricTypeHistogram,
				Unit: "By",
				Attributes: []Attribute{
					{Name: "http.request.method", Type: AttributeTypeString},
					{Name: "http.response.status_code", Type: AttributeTypeLong},
					{Name: "http.route", Type: AttributeTypeString},
					{Name: "network.protocol.version", Type: AttributeTypeString},
					{Name: "url.scheme", Type: AttributeTypeString},
				},
			},
		}
	}

	if isRPCPackage(pkgLower) {
		return []Metric{
			{
				Name: "rpc.server.duration",
				Type: MetricTypeHistogram,
				Unit: "ms",
				Attributes: []Attribute{
					{Name: "rpc.method", Type: AttributeTypeString},
					{Name: "rpc.service", Type: AttributeTypeString},
					{Name: "rpc.system", Type: AttributeTypeString},
				},
			},
			{
				Name: "rpc.server.request.size",
				Type: MetricTypeHistogram,
				Unit: "By",
				Attributes: []Attribute{
					{Name: "rpc.method", Type: AttributeTypeString},
					{Name: "rpc.service", Type: AttributeTypeString},
					{Name: "rpc.system", Type: AttributeTypeString},
				},
			},
			{
				Name: "rpc.server.response.size",
				Type: MetricTypeHistogram,
				Unit: "By",
				Attributes: []Attribute{
					{Name: "rpc.method", Type: AttributeTypeString},
					{Name: "rpc.service", Type: AttributeTypeString},
					{Name: "rpc.system", Type: AttributeTypeString},
				},
			},
		}
	}

	if isRuntimePackage(pkgPath) {
		return []Metric{
			{
				Name: "go.memory.used",
				Type: MetricTypeGauge,
				Unit: "By",
			},
			{
				Name: "go.memory.limit",
				Type: MetricTypeGauge,
				Unit: "By",
			},
			{
				Name: "go.memory.allocated",
				Type: MetricTypeCounter,
				Unit: "By",
			},
			{
				Name: "go.memory.allocations",
				Type: MetricTypeCounter,
				Unit: "{allocation}",
			},
			{
				Name: "go.memory.gc.goal",
				Type: MetricTypeGauge,
				Unit: "By",
			},
			{
				Name: "go.goroutine.count",
				Type: MetricTypeGauge,
				Unit: "{goroutine}",
			},
			{
				Name: "go.processor.limit",
				Type: MetricTypeGauge,
				Unit: "{thread}",
			},
			{
				Name: "go.config.gogc",
				Type: MetricTypeGauge,
				Unit: "%",
			},
		}
	}

	if isHostPackage(pkgPath) {
		return []Metric{
			{
				Name: "process.cpu.time",
				Type: MetricTypeCounter,
				Unit: "s",
				Attributes: []Attribute{
					{Name: "state", Type: AttributeTypeString},
				},
			},
			{
				Name: "system.cpu.time",
				Type: MetricTypeCounter,
				Unit: "s",
				Attributes: []Attribute{
					{Name: "state", Type: AttributeTypeString},
				},
			},
			{
				Name: "system.memory.usage",
				Type: MetricTypeGauge,
				Unit: "By",
				Attributes: []Attribute{
					{Name: "state", Type: AttributeTypeString},
				},
			},
			{
				Name: "system.memory.utilization",
				Type: MetricTypeGauge,
				Unit: "1",
				Attributes: []Attribute{
					{Name: "state", Type: AttributeTypeString},
				},
			},
			{
				Name: "system.network.io",
				Type: MetricTypeCounter,
				Unit: "By",
				Attributes: []Attribute{
					{Name: "direction", Type: AttributeTypeString},
				},
			},
		}
	}

	return nil
}
