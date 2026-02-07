import { useVersions, useInstrumentations } from "@/hooks/use-javaagent-data";

export function JavaAgentPage() {
  const versions = useVersions();
  const latestVersion = versions.data?.versions.find((v) => v.is_latest)?.version;
  const instrumentations = useInstrumentations(latestVersion || "");

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

        <div className="rounded-lg border border-border/50 bg-card/50 p-8 text-center">
          <p className="text-muted-foreground">Java Agent explorer coming soon...</p>

          {/* Data loading status */}
          <div className="mt-4 pt-4 border-t border-border/50">
            {versions.loading && (
              <p className="text-sm text-muted-foreground">Loading versions...</p>
            )}
            {versions.error && (
              <p className="text-sm text-red-500">Error: {versions.error.message}</p>
            )}
            {latestVersion && instrumentations.loading && (
              <p className="text-sm text-muted-foreground">
                Loading instrumentations for version {latestVersion}...
              </p>
            )}
            {instrumentations.error && (
              <p className="text-sm text-red-500">Error: {instrumentations.error.message}</p>
            )}
            {!instrumentations.loading && instrumentations.data && (
              <p className="text-sm text-muted-foreground">
                Loaded {instrumentations.data.length} instrumentations for version {latestVersion}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
