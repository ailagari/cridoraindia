/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_CAPACITOR_BUILD: string
  readonly VITE_FCM_ENABLED: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
