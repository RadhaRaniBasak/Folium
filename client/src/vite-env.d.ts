/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Socket.io server URL when the API lives on another origin (e.g. Vercel → Render). */
  readonly VITE_SOCKET_URL?: string;
}
