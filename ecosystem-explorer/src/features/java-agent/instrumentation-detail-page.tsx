import { useParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { BackButton } from "@/components/ui/back-button";
import { useVersions, useInstrumentation } from "@/hooks/use-javaagent-data";

export function InstrumentationDetailPage() {
  const { version, name } = useParams<{ version: string; name: string }>();
  const navigate = useNavigate();

  const { data: versionsData, loading: versionsLoading } = useVersions();
  const {
    data: instrumentation,
    loading: instrumentationLoading,
    error,
  } = useInstrumentation(name!, version!);

  const loading = versionsLoading || instrumentationLoading;

  useEffect(() => {
    if (version === "latest" && versionsData) {
      const latestVersion = versionsData.versions.find((v) => v.is_latest)?.version;
      if (latestVersion && name) {
        navigate(`/java-agent/instrumentation/${latestVersion}/${name}`, { replace: true });
      }
    }
  }, [version, name, versionsData, navigate]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-2">
            <div className="text-lg font-medium">Loading instrumentation...</div>
            <div className="text-sm text-muted-foreground">This may take a moment</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <BackButton />
        <div className="mt-6 p-6 border border-red-500/50 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
          <h3 className="font-semibold mb-2">Error loading instrumentation</h3>
          <p className="text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  if (!instrumentation) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <BackButton />
        <div className="mt-6 p-6 border border-yellow-500/50 rounded-lg bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
          <h3 className="font-semibold mb-2">Instrumentation not found</h3>
          <p className="text-sm">
            The instrumentation &quot;{name}&quot; could not be found in version {version}.
          </p>
        </div>
      </div>
    );
  }

  const displayName = instrumentation.display_name || instrumentation.name;
  const showRawName =
    instrumentation.display_name && instrumentation.display_name !== instrumentation.name;

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <BackButton />

      <div className="mt-6 space-y-6">
        <header className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-foreground">{displayName}</h1>
              {showRawName && (
                <p className="mt-2 text-sm text-muted-foreground">
                  <span className="font-medium">Instrumentation Name:</span>{" "}
                  <code className="px-2 py-1 bg-muted rounded text-foreground">
                    {instrumentation.name}
                  </code>
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-sm text-muted-foreground font-medium">Version:</span>
              <span className="px-3 py-1 bg-primary/10 text-primary rounded-md text-sm font-medium">
                {version}
              </span>
            </div>
          </div>

          {instrumentation.description && (
            <p className="text-base text-muted-foreground">{instrumentation.description}</p>
          )}
        </header>

        {/* Additional sections will be added in future iterations */}
        <div className="p-6 border border-border rounded-lg bg-muted/50">
          <p className="text-sm text-muted-foreground text-center">
            Additional instrumentation details will be displayed here in upcoming updates.
          </p>
        </div>
      </div>
    </div>
  );
}
