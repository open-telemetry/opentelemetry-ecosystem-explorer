import { Compass } from "lucide-react";
import {HeroSection} from "@/components/hero-section.tsx";
import {ExploreSection} from "@/components/explore-section.tsx";

export default function App() {
    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/30 bg-background/95 backdrop-blur-xl">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Compass className="h-5 w-5 text-primary" />
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
            <main className="pt-16">
                <HeroSection />
                <ExploreSection />
            </main>

            {/* Footer */}
            <footer className="border-t border-border/30 py-6 px-6 bg-background">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Compass className="h-4 w-4 text-primary" />
                        <span className="text-sm">OpenTelemetry Ecosystem Explorer</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Charting the observability landscape
                    </p>
                </div>
            </footer>
        </div>
    );
}
