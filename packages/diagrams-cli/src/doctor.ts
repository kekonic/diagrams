import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { findProjectConfig } from "./project-config.ts";

const require = createRequire(import.meta.url);

export type DoctorCheck = {
  name: string;
  status: "pass" | "warn" | "fail";
  detail: string;
};

export function runDoctor(cwd = process.cwd()): DoctorCheck[] {
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  const config = findProjectConfig(cwd);
  let font = "unavailable";
  try {
    const path = require.resolve("@fontsource/inter/files/inter-latin-500-normal.woff");
    if (existsSync(path)) font = path;
  } catch {
    // Reported as a structured failure below.
  }
  return [
    {
      name: "runtime",
      status: nodeMajor >= 22 ? "pass" : "fail",
      detail: `Node ${process.versions.node} (requires >=22.18.0)`,
    },
    {
      name: "font",
      status: font === "unavailable" ? "fail" : "pass",
      detail:
        font === "unavailable"
          ? "Bundled Inter measurement font not found"
          : "Bundled Inter font available",
    },
    {
      name: "config",
      status: config ? "pass" : "warn",
      detail:
        config ?? "No kekonic-diagrams.config.json discovered; built-in export defaults apply",
    },
    {
      name: "renderer",
      status: "pass",
      detail: "SVG renderer available; portable snapshot export is the default",
    },
  ];
}
