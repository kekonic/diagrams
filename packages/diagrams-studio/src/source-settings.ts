import {
  parse,
  type DiagramAst,
  type PropertyMap,
  type PropertyValue,
  type StatementAst,
} from "@kekonic/diagrams-core";
import type { StudioPresentationControls } from "./presentation.ts";

export type StudioSourceSetting =
  | "theme"
  | "direction"
  | "density"
  | "groupLayout"
  | "edgeStyle"
  | "crossings";

export type StudioSourceSettings = Pick<StudioPresentationControls, StudioSourceSetting>;

const EMPTY_SETTINGS: StudioSourceSettings = {
  theme: "dark",
  direction: "",
  density: "",
  groupLayout: "",
  edgeStyle: "",
  crossings: "",
};

export function readStudioSourceSettings(source: string): StudioSourceSettings {
  const diagram = firstDiagram(source);
  if (!diagram) return { ...EMPTY_SETTINGS };
  const result = { ...EMPTY_SETTINGS };
  for (const statement of diagram.statements) {
    if (statement.type === "Directive" && statement.name === "direction") {
      result.direction = oneOf(String(statement.value ?? ""), ["LR", "RL", "TD", "BT"]);
    } else if (statement.type === "Directive" && statement.name === "density") {
      result.density = oneOf(String(statement.value ?? ""), ["compact", "normal", "spacious"]);
    } else if (statement.type === "LayoutBlock") {
      const direction = stringProperty(statement.properties, "direction");
      const density = stringProperty(statement.properties, "density");
      if (direction) result.direction = oneOf(direction, ["LR", "RL", "TD", "BT"]);
      if (density) result.density = oneOf(density, ["compact", "normal", "spacious"]);
      const groupLayout = stringProperty(statement.properties, "groupLayout");
      if (groupLayout) {
        result.groupLayout = oneOf(groupLayout, ["auto", "compound", "flat", "swimlane"]);
      }
    } else if (statement.type === "EdgePolicyBlock") {
      const edgeStyle = stringProperty(statement.properties, "route");
      const crossings = stringProperty(statement.properties, "crossings");
      if (edgeStyle) {
        result.edgeStyle = oneOf(edgeStyle, [
          "metro",
          "rounded",
          "orthogonal",
          "straight",
          "bezier",
        ]);
      }
      if (crossings) result.crossings = oneOf(crossings, ["jumps", "smart", "gaps", "none"]);
    } else if (statement.type === "RenderBlock") {
      result.theme =
        oneOf(String(statement.properties.theme ?? "dark"), ["dark", "light"]) || "dark";
    }
  }
  return result;
}

/** Apply one end-user diagram setting as a minimal source edit. Empty values remove the setting. */
export function updateStudioSourceSetting(
  source: string,
  setting: StudioSourceSetting,
  value: string,
): string {
  const diagram = firstDiagram(source);
  if (!diagram) return source;
  if (setting === "direction" || setting === "density") {
    const layout = diagram.statements.find((item) => item.type === "LayoutBlock");
    if (value && layout?.properties[setting] != null) {
      return updateBlock(source, diagram, "LayoutBlock", "layout", setting, value);
    }
    const withoutDirective = updateDirective(source, diagram, setting, value);
    if (value) return withoutDirective;
    const reparsed = firstDiagram(withoutDirective);
    return reparsed
      ? updateBlock(withoutDirective, reparsed, "LayoutBlock", "layout", setting, "")
      : withoutDirective;
  }
  if (setting === "groupLayout") {
    return updateBlock(source, diagram, "LayoutBlock", "layout", "groupLayout", value);
  }
  if (setting === "theme") {
    return updateBlock(source, diagram, "RenderBlock", "render", "theme", value);
  }
  return updateBlock(
    source,
    diagram,
    "EdgePolicyBlock",
    "edges",
    setting === "edgeStyle" ? "route" : "crossings",
    value,
  );
}

export function resetStudioSourceSettings(source: string): string {
  return (Object.keys(EMPTY_SETTINGS) as StudioSourceSetting[]).reduce(
    (current, setting) => updateStudioSourceSetting(current, setting, ""),
    source,
  );
}

function firstDiagram(source: string): DiagramAst | null {
  const first = parse(source).body[0];
  return first?.type === "Diagram" ? first : null;
}

function updateDirective(
  source: string,
  diagram: DiagramAst,
  name: "direction" | "density",
  value: string,
): string {
  const statement = diagram.statements.find(
    (item): item is Extract<StatementAst, { type: "Directive" }> =>
      item.type === "Directive" && item.name === name,
  );
  if (statement) {
    if (!value) return removePolicyStatement(source, diagram, statement);
    return replaceRange(
      source,
      statement.range.start.offset,
      statement.range.end.offset,
      `${name} ${value}`,
    );
  }
  return value
    ? insertPolicyStatement(source, diagram, `${name} ${value}`, policyRank(name))
    : source;
}

function updateBlock(
  source: string,
  diagram: DiagramAst,
  type: "LayoutBlock" | "EdgePolicyBlock" | "RenderBlock",
  keyword: "layout" | "edges" | "render",
  property: string,
  value: string,
): string {
  const block = diagram.statements.find((item) => item.type === type) as
    | Extract<StatementAst, { type: "LayoutBlock" | "EdgePolicyBlock" | "RenderBlock" }>
    | undefined;
  if (!block) {
    return value
      ? insertPolicyStatement(
          source,
          diagram,
          printBlock(keyword, { [property]: value }),
          policyRank(keyword),
        )
      : source;
  }
  const blockSource = source.slice(block.range.start.offset, block.range.end.offset);
  const openingBrace = blockSource.indexOf("{");
  const closingBrace = blockSource.lastIndexOf("}");
  const body = blockSource.slice(openingBrace + 1, closingBrace);
  if (!body.includes("\n")) {
    const properties: PropertyMap = { ...block.properties };
    if (value) properties[property] = value;
    else delete properties[property];
    if (Object.keys(properties).length === 0) return removePolicyStatement(source, diagram, block);
    return replaceRange(
      source,
      block.range.start.offset,
      block.range.end.offset,
      printBlock(keyword, properties),
    );
  }
  const propertyLine = new RegExp(
    `^([\\t ]*${escapeRegex(property)}[\\t ]*:[\\t ]*)(.*?)([\\t ]*//.*)?$`,
    "m",
  );
  const match = propertyLine.exec(blockSource);
  if (match) {
    const updatedBlock = value
      ? blockSource.replace(propertyLine, `$1${value}$3`)
      : removeMatchedLine(blockSource, match.index, match[0].length);
    const updatedBody = updatedBlock.slice(
      updatedBlock.indexOf("{") + 1,
      updatedBlock.lastIndexOf("}"),
    );
    if (!updatedBody.trim()) return removePolicyStatement(source, diagram, block);
    return replaceRange(source, block.range.start.offset, block.range.end.offset, updatedBlock);
  }
  if (!value) return source;
  const indent = indentationAt(source, block.range.start.offset);
  const addition = `${indent}  ${property}: ${value}\n`;
  const updatedBlock = `${blockSource.slice(0, closingBrace)}${addition}${blockSource.slice(closingBrace)}`;
  return replaceRange(source, block.range.start.offset, block.range.end.offset, updatedBlock);
}

function printBlock(keyword: string, properties: PropertyMap, indent = ""): string {
  const lines = Object.entries(properties).map(
    ([key, value]) => `${indent}  ${key}: ${printValue(value)}`,
  );
  return `${keyword} {\n${lines.join("\n")}\n${indent}}`;
}

function insertPolicyStatement(
  source: string,
  diagram: DiagramAst,
  statement: string,
  rank: number,
): string {
  const indent = `${indentationAt(source, diagram.range.start.offset)}  `;
  const rendered = statement
    .split("\n")
    .map((line) => `${indent}${line}`)
    .join("\n");
  const target = diagram.statements.find((item) => policyRank(item) > rank);
  if (target) {
    const insertionOffset = source.lastIndexOf("\n", target.range.start.offset - 1) + 1;
    const separatesContent = policyRank(target) === Number.POSITIVE_INFINITY;
    return `${source.slice(0, insertionOffset)}${rendered}\n${separatesContent ? "\n" : ""}${source.slice(insertionOffset)}`;
  }

  const closingBrace = source.lastIndexOf("}", diagram.range.end.offset);
  if (closingBrace < 0) return source;
  return `${source.slice(0, closingBrace)}${rendered}\n${source.slice(closingBrace)}`;
}

function policyRank(
  value: StatementAst | "direction" | "density" | "layout" | "edges" | "render",
): number {
  const name =
    typeof value === "string"
      ? value
      : value.type === "Directive"
        ? value.name
        : value.type === "LayoutBlock"
          ? "layout"
          : value.type === "EdgePolicyBlock"
            ? "edges"
            : value.type === "RenderBlock"
              ? "render"
              : value.type === "PresentationBlock"
                ? "presentation"
                : "content";
  const order = ["direction", "density", "layout", "edges", "render", "presentation"];
  return order.indexOf(name) === -1 ? Number.POSITIVE_INFINITY : order.indexOf(name);
}

function removeStatementLine(source: string, statement: StatementAst): string {
  const start = source.lastIndexOf("\n", statement.range.start.offset - 1) + 1;
  const nextNewline = source.indexOf("\n", statement.range.end.offset);
  const end = nextNewline < 0 ? statement.range.end.offset : nextNewline + 1;
  return replaceRange(source, start, end, "");
}

function removePolicyStatement(
  source: string,
  diagram: DiagramAst,
  statement: StatementAst,
): string {
  const updated = removeStatementLine(source, statement);
  const hasOtherPolicy = diagram.statements.some(
    (item) => item !== statement && policyRank(item) < Number.POSITIVE_INFINITY,
  );
  if (hasOtherPolicy) return updated;

  const firstStatement = firstDiagram(updated)?.statements[0];
  if (!firstStatement) return updated;
  const lineStart = updated.lastIndexOf("\n", firstStatement.range.start.offset - 1) + 1;
  const preceding = updated.slice(0, lineStart);
  return preceding.endsWith("\n\n")
    ? `${preceding.slice(0, -1)}${updated.slice(lineStart)}`
    : updated;
}

function indentationAt(source: string, offset: number): string {
  const lineStart = source.lastIndexOf("\n", offset - 1) + 1;
  return /^\s*/.exec(source.slice(lineStart, offset))?.[0] ?? "";
}

function replaceRange(source: string, start: number, end: number, replacement: string): string {
  return `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

function stringProperty(properties: PropertyMap, name: string): string {
  const value = properties[name];
  return typeof value === "string" ? value : "";
}

function printValue(value: PropertyValue): string {
  return Array.isArray(value) ? `[${value.join(", ")}]` : String(value);
}

function removeMatchedLine(source: string, start: number, length: number): string {
  const lineStart = source.lastIndexOf("\n", start - 1) + 1;
  const nextNewline = source.indexOf("\n", start + length);
  const lineEnd = nextNewline < 0 ? start + length : nextNewline + 1;
  return `${source.slice(0, lineStart)}${source.slice(lineEnd)}`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function oneOf<const Value extends string>(value: string, allowed: readonly Value[]): Value | "" {
  return allowed.includes(value as Value) ? (value as Value) : "";
}
