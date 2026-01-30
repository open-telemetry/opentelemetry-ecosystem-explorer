import { Coffee, Server } from "lucide-react";
import { NavigationCard } from "./navigation-card";

export function ExploreSection() {
    return (
        <section className="relative py-8 px-6 bg-background">
            {/* Section divider */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-12 bg-gradient-to-b from-transparent via-primary/30 to-transparent" />

            <div className="max-w-6xl mx-auto">
                <div className="grid md:grid-cols-2 gap-4">
                    <NavigationCard
                        title="OpenTelemetry Java Agent"
                        description="Explore auto-instrumentation for Java applications. Discover supported libraries, configuration options, and emitted telemetry."
                        href="/java-agent"
                        icon={<Coffee className="h-6 w-6" />}
                    />
                    <NavigationCard
                        title="OpenTelemetry Collector"
                        description="Navigate Collector components like receivers, processors, and exporters."
                        href="/collector"
                        icon={<Server className="h-6 w-6" />}
                    />
                </div>
            </div>
        </section>
    );
}
