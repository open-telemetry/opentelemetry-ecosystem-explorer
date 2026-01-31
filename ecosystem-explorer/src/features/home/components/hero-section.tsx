import { Compass } from "@/components/icons/compass";

export function HeroSection() {
    return (
        <section className="relative flex items-center justify-center overflow-hidden bg-background py-8">
            <div className="relative z-10 flex flex-col items-center gap-6 px-6 text-center">
                <Compass className="w-24 h-24 md:w-32 md:h-32 text-foreground" />

                <div className="space-y-2">
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-balance leading-tight">
                        <span className="text-foreground">OpenTelemetry</span>
                        <br />
                        <span style={{ color: 'hsl(var(--color-secondary))' }}>Ecosystem Explorer</span>
                    </h1>

                    <p className="max-w-2xl mx-auto text-sm md:text-base text-muted-foreground leading-relaxed text-balance">
                        Navigate the vast landscape of OpenTelemetry.
                    </p>
                </div>
            </div>
        </section>
    );
}
