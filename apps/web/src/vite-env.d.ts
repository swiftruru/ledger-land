/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />
declare module '*.po' {
  import type { Messages } from '@lingui/core';
  export const messages: Messages;
}
declare const __LL_APP_VERSION__: string;
declare const __LL_BUILT_AT__: string;
/** 幕後頁技術棧的版本號（apps/web/stack-versions.config.ts 在建置時注入） */
declare const __LL_STACK_VERSIONS__: Readonly<Record<string, string>>;
