import { AgentExploreLanding } from "@/features/java-agent/components/agent-explore-landing.tsx";

export function JavaAgentPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">OpenTelemetry Java Agent</h1>
          <p className="text-muted-foreground">
            Explore auto-instrumentation for Java applications. Discover supported libraries,
            configuration options, and emitted telemetry.
          </p>
        </div>
        <AgentExploreLanding />
      </div>
    </div>
  );
}
