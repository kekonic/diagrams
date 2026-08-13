import { PassThrough } from "node:stream";
import { describe, expect, it } from "vite-plus/test";
import { runLanguageServer } from "./lsp-server.ts";

type Message = { id?: number; method?: string; result?: unknown; params?: unknown };

describe("KDiagram LSP stdio server", () => {
  it("frames JSON-RPC, publishes diagnostics, and serves language features", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const chunks: Buffer[] = [];
    output.on("data", (chunk: Buffer) => chunks.push(chunk));
    const running = runLanguageServer(input, output);

    write(input, { jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    write(input, {
      jsonrpc: "2.0",
      method: "textDocument/didOpen",
      params: {
        textDocument: {
          uri: "file:///test.kdiagram",
          version: 1,
          text: 'diagram {\n  api: service "API"\n  api -> missing\n}\n',
        },
      },
    });
    write(input, {
      jsonrpc: "2.0",
      id: 2,
      method: "textDocument/completion",
      params: {
        textDocument: { uri: "file:///test.kdiagram" },
        position: { line: 1, character: 7 },
      },
    });
    write(input, { jsonrpc: "2.0", id: 3, method: "shutdown", params: null });
    write(input, { jsonrpc: "2.0", method: "exit", params: null });
    input.end();

    await expect(running).resolves.toBe(0);
    const messages = parseMessages(Buffer.concat(chunks));
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 1,
          result: expect.objectContaining({
            capabilities: expect.objectContaining({ hoverProvider: true }),
          }),
        }),
        expect.objectContaining({ method: "textDocument/publishDiagnostics" }),
        expect.objectContaining({ id: 2, result: expect.any(Array) }),
        expect.objectContaining({ id: 3, result: null }),
      ]),
    );
  });
});

function write(stream: PassThrough, message: object): void {
  const body = JSON.stringify(message);
  stream.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
}

function parseMessages(buffer: Buffer): Message[] {
  const messages: Message[] = [];
  let offset = 0;
  while (offset < buffer.length) {
    const headerEnd = buffer.indexOf("\r\n\r\n", offset);
    if (headerEnd < 0) break;
    const header = buffer.subarray(offset, headerEnd).toString("ascii");
    const length = Number(/Content-Length:\s*(\d+)/iu.exec(header)?.[1]);
    const start = headerEnd + 4;
    messages.push(JSON.parse(buffer.subarray(start, start + length).toString("utf8")) as Message);
    offset = start + length;
  }
  return messages;
}
