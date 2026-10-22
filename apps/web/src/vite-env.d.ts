/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />
declare module '*.po' {
  import type { Messages } from '@lingui/core';
  export const messages: Messages;
}
declare const __LL_APP_VERSION__: string;
declare const __LL_BUILT_AT__: string;
