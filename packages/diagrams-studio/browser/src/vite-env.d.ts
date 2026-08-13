/// <reference types="vite/client" />

declare module "*.css";

interface ImportMeta {
  readonly glob: <T = Record<string, () => Promise<unknown>>>(
    pattern: string,
    options?: {
      eager?: boolean;
      import?: string;
      query?: string;
    },
  ) => T;
}

declare module "*.kdiagram?raw" {
  const content: string;
  export default content;
}
