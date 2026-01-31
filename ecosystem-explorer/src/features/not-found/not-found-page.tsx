import { Link } from "react-router-dom";
import { Compass } from "@/components/icons/compass";

export function NotFoundPage() {
    return (
        <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col items-center justify-center min-h-[60vh]">
            <Compass className="w-32 h-32 mb-8 opacity-50" />

            <h1 className="text-4xl font-bold text-foreground mb-4">
                404 - Page Not Found
            </h1>

            <p className="text-muted-foreground mb-8 text-center max-w-md">
                The page you're looking for doesn't exist. You may have mistyped the address or the page may have moved.
            </p>

            <Link
                to="/"
                className="px-6 py-3 rounded-lg bg-primary/10 border border-primary/40 text-foreground hover:bg-primary/20 transition-colors"
            >
                Return to Home
            </Link>
        </div>
    );
}
