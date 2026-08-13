import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { setIconifyApiBaseUrl } from "@kekonic/diagrams-icons";
import "./monaco-workers.ts";
import "./styles.ts";
import { App } from "./App.tsx";
import { studioIconApiBaseUrl } from "./lib/host.ts";

setIconifyApiBaseUrl(studioIconApiBaseUrl(document));

const root = document.getElementById("app");
if (!root) throw new Error("#app missing");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
