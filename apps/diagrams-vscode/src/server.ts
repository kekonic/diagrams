#!/usr/bin/env node
import { runLanguageServer } from "@kekonic/diagrams-cli/lsp";

void runLanguageServer().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  },
);
