declare module "*.kdiagram?svg" {
  const svg: string;
  export default svg;
}

declare module "*.kdiagram?url" {
  const url: string;
  export default url;
}

declare module "*.kdiagram?source" {
  const source: string;
  export default source;
}

declare module "*.kdiagram?react" {
  import type { ComponentType } from "react";
  import type { KDiagramLiveProps } from "@kekonic/diagrams-ui";
  export const source: string;
  const Diagram: ComponentType<Omit<KDiagramLiveProps, "source">>;
  export default Diagram;
}

declare module "*.kdiagram?element" {
  import type { KDiagramElement } from "@kekonic/diagrams-element";
  export const source: string;
  const Diagram: new () => KDiagramElement;
  export default Diagram;
}
