import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, parse, resolve } from "node:path";
import { registerTheme, type PresentationOptions } from "@kekonic/diagrams";
import { CliUsageError, type ParsedCommand } from "./command-model.ts";

const DEFAULT_CONFIG = "kekonic-diagrams.config.json";

export type ExportProfile = {
  theme?: string;
  snapshotTheme?: boolean;
  background?: "transparent" | "theme";
  embedFonts?: boolean;
  printSafe?: boolean;
  presentation?: PresentationOptions;
  format?: "svg" | "png" | "pdf";
};

export type ProjectConfig = {
  version: 1;
  defaultProfile?: string;
  themes?: Record<string, Record<string, string>>;
  profiles?: Record<string, ExportProfile>;
};

export type ResolvedRenderSettings = Required<
  Pick<ExportProfile, "theme" | "snapshotTheme" | "background" | "embedFonts" | "printSafe">
> & {
  presentation?: PresentationOptions;
  configPath?: string;
  profileName?: string;
  warnings: string[];
};

export function resolveRenderSettings(
  command: ParsedCommand,
  cwd = process.cwd(),
): ResolvedRenderSettings {
  const loaded = loadProjectConfig(command.options.config, cwd);
  const config = loaded?.config;
  const configDir = loaded ? dirname(loaded.path) : cwd;

  for (const [name, tokens] of Object.entries(config?.themes ?? {})) {
    validateTokens(tokens, `themes.${name}`);
    registerTheme(name, tokens);
  }
  if (command.options.themeFile) {
    const themePath = resolve(configDir, command.options.themeFile);
    const parsed = readJson(themePath);
    const name = command.options.theme ?? "custom";
    const tokens = isRecord(parsed) && isRecord(parsed.tokens) ? parsed.tokens : parsed;
    validateTokens(tokens, themePath);
    registerTheme(name, tokens);
  }

  const profileName = command.options.profile ?? config?.defaultProfile;
  const profile = profileName ? config?.profiles?.[profileName] : undefined;
  if (profileName && !profile) {
    throw new CliUsageError(`Unknown export profile: ${profileName}`);
  }
  if (profile?.format && profile.format !== "svg") {
    throw new CliUsageError(
      `Export profile ${profileName} requests ${profile.format}; this CLI build supports SVG output`,
    );
  }

  const printSafe = command.options.printSafe || profile?.printSafe === true;
  const snapshotTheme = command.options.liveTheme
    ? false
    : command.options.snapshot || profile?.snapshotTheme !== false;
  const settings: ResolvedRenderSettings = {
    theme: command.options.theme ?? profile?.theme ?? (printSafe ? "light" : "dark"),
    snapshotTheme,
    background:
      command.options.background ?? profile?.background ?? (printSafe ? "theme" : "transparent"),
    embedFonts: command.options.embedFonts || profile?.embedFonts === true,
    printSafe,
    presentation: profile?.presentation,
    configPath: loaded?.path,
    profileName,
    warnings: [],
  };
  if (!snapshotTheme) {
    settings.warnings.push(
      "live-theme SVG retains unresolved CSS custom properties and requires KDiagram theme tokens from its host",
    );
  }
  return settings;
}

export function findProjectConfig(cwd: string): string | undefined {
  let current = resolve(cwd);
  const root = parse(current).root;
  while (true) {
    const candidate = join(current, DEFAULT_CONFIG);
    if (existsSync(candidate)) return candidate;
    if (current === root) return undefined;
    current = dirname(current);
  }
}

function loadProjectConfig(
  explicitPath: string | undefined,
  cwd: string,
): { path: string; config: ProjectConfig } | undefined {
  const path = explicitPath
    ? isAbsolute(explicitPath)
      ? explicitPath
      : resolve(cwd, explicitPath)
    : findProjectConfig(cwd);
  if (!path) return undefined;
  if (!existsSync(path)) throw new CliUsageError(`Config file does not exist: ${path}`);
  const parsed = readJson(path);
  if (!isRecord(parsed) || parsed.version !== 1) {
    throw new CliUsageError(`${path}: expected { "version": 1, ... }`);
  }
  validateConfigKeys(parsed, path);
  return { path, config: parsed as ProjectConfig };
}

function validateConfigKeys(value: Record<string, unknown>, path: string): void {
  const allowed = new Set(["version", "defaultProfile", "themes", "profiles", "$schema"]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new CliUsageError(`${path}: unknown config property ${key}`);
  }
  if (value.profiles != null && !isRecord(value.profiles)) {
    throw new CliUsageError(`${path}: profiles must be an object`);
  }
  for (const [name, profile] of Object.entries((value.profiles as object | undefined) ?? {})) {
    if (!isRecord(profile)) throw new CliUsageError(`${path}: profile ${name} must be an object`);
    const profileKeys = new Set([
      "theme",
      "snapshotTheme",
      "background",
      "embedFonts",
      "printSafe",
      "presentation",
      "format",
    ]);
    for (const key of Object.keys(profile)) {
      if (!profileKeys.has(key)) {
        throw new CliUsageError(`${path}: unknown profiles.${name}.${key}`);
      }
    }
  }
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new CliUsageError(
      `${path}: ${error instanceof Error ? error.message : "could not read JSON"}`,
    );
  }
}

function validateTokens(value: unknown, label: string): asserts value is Record<string, string> {
  if (!isRecord(value)) throw new CliUsageError(`${label}: theme tokens must be an object`);
  for (const [key, token] of Object.entries(value)) {
    if (!/^--[a-zA-Z0-9_-]+$/.test(key) || typeof token !== "string") {
      throw new CliUsageError(`${label}: theme tokens must map --custom-properties to strings`);
    }
    if (/[;{}<>@]/.test(token) || /url\s*\(/i.test(token)) {
      throw new CliUsageError(`${label}.${key}: theme token contains unsupported CSS syntax`);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}
