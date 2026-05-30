// Polyfill Buffer for browser environment (required by Solana/Jupiter swap libs)
import { Buffer } from "buffer";
(window as any).Buffer = Buffer;

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
