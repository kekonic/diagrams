declare module "elkjs/lib/elk.bundled.js" {
  type ElkLayoutOptions = Record<string, string>;
  type ElkGraph = {
    id: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    children?: ElkGraph[];
    edges?: Array<{
      id: string;
      sources: string[];
      targets: string[];
      sections?: Array<{
        startPoint: { x: number; y: number };
        endPoint: { x: number; y: number };
        bendPoints?: Array<{ x: number; y: number }>;
      }>;
    }>;
    layoutOptions?: ElkLayoutOptions;
  };

  export default class ELK {
    constructor(options?: { defaultLayoutOptions?: ElkLayoutOptions });
    layout(graph: ElkGraph): Promise<ElkGraph>;
  }
}
