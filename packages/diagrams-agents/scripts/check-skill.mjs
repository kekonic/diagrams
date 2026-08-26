import { readFile, readdir } from "node:fs/promises";

const skill = await readFile(new URL("../SKILL.md", import.meta.url), "utf8");
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const references = await readdir(new URL("../references/", import.meta.url));

if (!skill.startsWith("---\nname: design-kekonic-diagrams\n")) {
  throw new Error("SKILL.md must declare the public skill name");
}
if (!skill.includes("description:") || skill.includes("TODO")) {
  throw new Error("SKILL.md must contain complete trigger metadata");
}
if (packageJson.name !== "@kekonic/diagrams-agents") {
  throw new Error("Unexpected package name");
}
if (
  references.sort().join(",") !==
  "architecture-grounding.md,business-workflows.md,choosing-kdiagram-elements.md,compare-layouts.md,delivery-checklist.md,diagram-selection.md,editorial-design.md,event-driven.md,examples,hexagonal-architecture.md,repair-order.md,state-machines.md,views-and-intent.md"
) {
  throw new Error("Unexpected skill reference set");
}
for (const reference of references) {
  if (reference === "examples") {
    continue;
  }
  if (!skill.includes(`references/${reference}`)) {
    throw new Error(`SKILL.md does not route agents to ${reference}`);
  }
}

for (const example of [
  "order-fulfillment.md",
  "order-fulfillment.kdiagram",
  "order-fulfillment.svg",
  "order-hexagon.md",
  "order-hexagon.kdiagram",
  "order-hexagon.svg",
]) {
  await readFile(new URL(`../references/examples/${example}`, import.meta.url), "utf8");
}
if (!skill.includes("references/examples/order-fulfillment.md")) {
  throw new Error("SKILL.md does not route agents to the reference example");
}
if (!skill.includes("references/examples/order-hexagon.md")) {
  throw new Error("SKILL.md does not route agents to the hexagonal reference example");
}
if (!skill.includes("references/examples/order-hexagon.kdiagram")) {
  throw new Error("SKILL.md does not route agents to order-hexagon.kdiagram");
}

const repoExemplar = await readFile(
  new URL("../../../examples/order-fulfillment.kdiagram", import.meta.url),
  "utf8",
);
const packagedExemplar = await readFile(
  new URL("../references/examples/order-fulfillment.kdiagram", import.meta.url),
  "utf8",
);
if (repoExemplar !== packagedExemplar) {
  throw new Error(
    "packages/diagrams-agents/references/examples/order-fulfillment.kdiagram must match examples/order-fulfillment.kdiagram",
  );
}

const repoHexagon = await readFile(
  new URL("../../../examples/order-hexagon.kdiagram", import.meta.url),
  "utf8",
);
const packagedHexagon = await readFile(
  new URL("../references/examples/order-hexagon.kdiagram", import.meta.url),
  "utf8",
);
if (repoHexagon !== packagedHexagon) {
  throw new Error(
    "packages/diagrams-agents/references/examples/order-hexagon.kdiagram must match examples/order-hexagon.kdiagram",
  );
}

console.log("KDiagram agent skill contract is valid");
