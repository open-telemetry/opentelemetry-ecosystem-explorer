import React from "react"
import { ArrowRight } from "lucide-react";

interface NavigationCardProps {
    title: string;
    description: string;
    href: string;
    icon: React.ReactNode;
}

export function NavigationCard({
                                   title,
                                   description,
                                   href,
                                   icon,
                               }: NavigationCardProps) {
    return (
        <a href={href} className="group block h-full">
            <div className="relative overflow-hidden rounded-lg border border-border/50 bg-card/50 p-6 h-full transition-all duration-300 hover:border-primary/40 hover:bg-card hover:shadow-lg hover:shadow-primary/5">
                {/* Grid lines background */}
                <div className="absolute inset-0 opacity-5">
                    <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <pattern
                                id={`grid-${title}`}
                                width="20"
                                height="20"
                                patternUnits="userSpaceOnUse"
                            >
                                <path
                                    d="M 20 0 L 0 0 0 20"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="0.5"
                                    className="text-primary"
                                />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill={`url(#grid-${title})`} />
                    </svg>
                </div>

                <div className="relative z-10">
                    <div className="mb-4 flex items-center justify-between">
                        <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-border/50 bg-background/50 text-primary transition-colors group-hover:border-primary/40 group-hover:bg-primary/10">
                            {icon}
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground transition-all duration-300 group-hover:translate-x-1 group-hover:text-primary" />
                    </div>

                    <h3 className="mb-2 text-xl font-semibold text-foreground transition-colors group-hover:text-primary">
                        {title}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        {description}
                    </p>
                </div>

                {/* Corner accent */}
                <div className="absolute -bottom-1 -right-1 h-16 w-16 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <svg viewBox="0 0 64 64" className="h-full w-full">
                        <path
                            d="M64 64 L64 32 L48 32 L48 48 L32 48 L32 64 Z"
                            className="fill-primary/20"
                        />
                    </svg>
                </div>
            </div>
        </a>
    );
}
