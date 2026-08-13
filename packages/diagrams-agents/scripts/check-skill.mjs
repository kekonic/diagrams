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
  "architecture-grounding.md,business-workflows.md,choosing-kdiagram-elements.md,compare-layouts.md,delivery-checklist.md,diagram-selection.md,editorial-design.md,event-driven.md,examples,hexagonal-architecture.md,repair-order.md,state-machines.md"
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

for (const example of ["order-fulfillment.md", "order-fulfillment.kdiagram"]) {
  await readFile(new URL(`../references/examples/${example}`, import.meta.url), "utf8");
}
if (!skill.includes("references/examples/order-fulfillment.md")) {
  throw new Error("SKILL.md does not route agents to the reference example");
}

console.log("KDiagram agent skill contract is valid");
