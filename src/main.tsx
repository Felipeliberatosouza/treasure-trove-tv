import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initBrowserShiftTolerance } from "./utils/browserShiftTolerance";

initBrowserShiftTolerance();

createRoot(document.getElementById("root")!).render(<App />);
