/// <reference types="vite/client" />

declare module "*.kdiagram?raw" {
  const content: string;
  export default content;
}

declare module "@fontsource/inter/files/inter-latin-500-normal.woff?url" {
  const url: string;
  export default url;
}
