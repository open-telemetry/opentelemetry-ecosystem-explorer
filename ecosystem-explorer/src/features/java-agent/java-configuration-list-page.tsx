import { BackButton } from "@/components/ui/back-button";

export function JavaConfigurationListPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="space-y-6">
        <BackButton />
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            OpenTelemetry Java Agent Configuration
          </h1>
        </div>

        <div className="rounded-lg border border-border/50 bg-card/50 p-8 text-center">
          <p className="text-muted-foreground">Coming Soon...</p>
        </div>
      </div>
    </div>
  );
}
