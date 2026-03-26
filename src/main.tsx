import { createRoot } from "react-dom/client";
import ErrorBoundary from "@/components/ErrorBoundary";
import "./index.css";
// 🚨 EMERGENCY: ONLY IMPORTING ESSENTIAL STUFF 🚨
import React, { Suspense, lazy } from "react";

const App = lazy(() => import("./App.tsx"));

// DIAGNOSTIC BAR
const diag = document.createElement('div');
diag.style.cssText = "position:fixed;top:0;left:0;background:red;color:white;padding:4px;font-size:10px;z-index:99999;font-family:sans-serif";
diag.innerText = 'JS_LOADED (Waiting for React...)';
document.body.appendChild(diag);

console.log("CRITICAL: JS MAIN LOADED");

try {
  const rootElement = document.getElementById("root");
  if (rootElement) {
    createRoot(rootElement).render(
      <ErrorBoundary>
        <Suspense fallback={<div style={{color:'white', textAlign:'center', marginTop:'40vh'}}>Iniciando Componentes UI...</div>}>
          <App />
        </Suspense>
      </ErrorBoundary>
    );
    diag.style.background = 'green';
    diag.innerText = 'REACT_MOUNTED';
  }
} catch (e: any) {
  diag.style.background = 'black';
  diag.innerText = 'FATAL: ' + e.message;
}
