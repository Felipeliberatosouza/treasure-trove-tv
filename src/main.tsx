import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initBrowserShiftTolerance } from "./utils/browserShiftTolerance";
import { applyBranding, type BrandingVars } from "./lib/applyBranding";
import { readCachedSetting } from "./lib/brandingCache";

initBrowserShiftTolerance();

// Aplica a identidade visual guardada no acesso anterior ANTES da primeira
// renderização, evitando que o tema padrão apareça por alguns instantes.
applyBranding(readCachedSetting<BrandingVars>("branding"));

createRoot(document.getElementById("root")!).render(<App />);
