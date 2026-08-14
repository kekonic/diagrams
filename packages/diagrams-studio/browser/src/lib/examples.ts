export type ExampleEntry = { id: string; label: string; source: string };

/** Repo-root examples/ — five levels up from packages/diagrams-studio/browser/src/lib/. */
const exampleModules = import.meta.glob<string>("../../../../../examples/*.kdiagram", {
  query: "?raw",
  import: "default",
  eager: true,
});

export const STARTER = `diagram {
  direction LR
  a: service "A"
  b: service "B"
  a -> b
}
`;

export const EXAMPLES: ExampleEntry[] = Object.entries(exampleModules)
  .map(([path, source]) => {
    const file = path.split("/").pop()!;
    const id = file.replace(".kdiagram", "");
    const label = id
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    return { id, label, source };
  })
  .sort((a, b) => a.label.localeCompare(b.label));

const DEFAULT_ID = "order-fulfillment";
export const DEFAULT_EXAMPLE = EXAMPLES.find((entry) => entry.id === DEFAULT_ID) ?? EXAMPLES[0];
