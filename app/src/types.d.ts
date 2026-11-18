declare module '*?url' {
  const src: string;
  export default src;
}

interface ImportMetaEnv {
  readonly DEV: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
