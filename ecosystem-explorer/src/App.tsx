import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { HomePage } from "@/features/home/home-page";
import { JavaAgentPage } from "@/features/java-agent/java-agent-page";
import { CollectorPage } from "@/features/collector/collector-page";
import { NotFoundPage } from "@/features/not-found/not-found-page";

export default function App() {
    return (
        <BrowserRouter>
            <div className="min-h-screen bg-background flex flex-col">
                <Header />
                <main className="flex-1 pt-16">
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/java-agent" element={<JavaAgentPage />} />
                        <Route path="/collector" element={<CollectorPage />} />
                        <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                </main>
                <Footer />
            </div>
        </BrowserRouter>
    );
}
