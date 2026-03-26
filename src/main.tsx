import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import ErrorBoundary from "@/components/ErrorBoundary";
import "./index.css";

// 🚨 EMERGENCY DIAGNOSTIC 🚨
// This will write to the screen BEFORE React even tries to load
// If you see this message, the files are being served correctly!
const diag = document.createElement('div');
diag.style.position = 'fixed';
diag.style.top = '0';
diag.style.left = '0';
diag.style.background = 'red';
diag.style.color = 'white';
diag.style.padding = '5px';
diag.style.fontSize = '10px';
diag.style.zIndex = '9999';
diag.innerText = 'Surgical Alcon Booting...';
document.body.appendChild(diag);

console.log("BOOT: Initializing application...");

try {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("CRITICAL: Root element #root not found in index.html!");
  }

  createRoot(rootElement).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
  
  // If we reach here, tell the user it started
  diag.style.background = 'green';
  diag.innerText = 'Surgical Alcon Ready';
  setTimeout(() => diag.remove(), 2000);
} catch (e: any) {
  diag.style.background = 'orange';
  diag.innerText = 'BOOT ERROR: ' + e.message;
  console.error("BOOT ERROR:", e);
}
