import { createRoot } from "react-dom/client";
import ErrorBoundary from "@/components/ErrorBoundary";
import "./index.css";
import React, { Suspense, lazy } from "react";

// Lazy-load the main App component for performance
const App = lazy(() => import("./App.tsx"));

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <ErrorBoundary>
      <Suspense fallback={
        <div className="min-h-screen bg-[#111111] flex items-center justify-center">
          <div className="h-10 w-10 rounded-xl bg-[#45b649]/20 border border-[#45b649]/50 animate-pulse" />
        </div>
      }>
        <App />
      </Suspense>
    </ErrorBoundary>
  );
}
