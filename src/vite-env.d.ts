/// <reference types="vite/client" />

// Allow importing .wgsl shader files as strings
declare module "*.wgsl?raw" {
  const content: string;
  export default content;
}

declare module "*.wgsl" {
  const content: string;
  export default content;
}
