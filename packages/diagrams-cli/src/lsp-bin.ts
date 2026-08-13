#!/usr/bin/env node
import { runLanguageServer } from "./lsp-server.ts";

process.exitCode = await runLanguageServer();
