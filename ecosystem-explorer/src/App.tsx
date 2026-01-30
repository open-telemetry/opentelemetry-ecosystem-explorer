import { OtelLogo } from "@/components/otel-logo";
import {HeroSection} from "@/components/hero-section.tsx";
import {ExploreSection} from "@/components/explore-section.tsx";

export default function App() {
    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/30 bg-background/95 backdrop-blur-xl h-16">
                <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <OtelLogo className="h-6 w-6 text-primary" />
                        <span className="font-semibold text-foreground">
                            OTel Explorer
                        </span>
                    </div>
                    <nav className="hidden md:flex items-center gap-8">
                        <a
                            href="/java-agent"
                            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Java Agent
                        </a>
                        <a
                            href="/collector"
                            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Collector
                        </a>
                    </nav>
                </div>
            </header>

            {/* Main content */}
            <main className="flex-1 pt-16">
                <HeroSection />
                <ExploreSection />
            </main>

            {/* Footer */}
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
        </div>
    );
}
