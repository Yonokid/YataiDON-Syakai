/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly NETWORK_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
