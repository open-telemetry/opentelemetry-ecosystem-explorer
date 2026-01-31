import { OtelLogo } from "@/components/icons/otel-logo";

export function Footer() {
  return (
    <footer className="border-t border-border/30 h-16 px-6 bg-background flex-shrink-0">
      <div className="max-w-6xl mx-auto h-full flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          <OtelLogo className="h-5 w-5 text-primary" />
          <span className="text-sm">OpenTelemetry Ecosystem Explorer</span>
        </div>
        <p className="text-sm text-muted-foreground hidden md:block">
          Charting the observability landscape
        </p>
      </div>
    </footer>
  );
}
