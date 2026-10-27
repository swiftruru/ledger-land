// 站內連結的注入點（站規 1.17）：web-ui 不依賴 react-router（09 第 7.5 節的套件切分），由 apps/web 用 LinkProvider 注入 RouterLink。
// web-ui 裡所有站內連結（Button、IconButton、BackButton、StatChip、TextLink…）都經 UiLink 渲染：有 provider 時是 provider 的元件
// （react-router 的 Link，不會整頁重新載入），沒有時退回原生 <a>。站外網址（external）一律是 <a target="_blank" rel="noopener">，不經 provider
// （維護者 2026-10-27 決定：站外連結另開分頁，使用者不會離開網站；螢幕閱讀器的說明寫「另開分頁」）。
import { createContext, createElement, useContext, type AnchorHTMLAttributes, type ComponentType, type ReactNode, type Ref } from 'react';

/** provider 元件收到的 props：href 一定有；onClick 裡 preventDefault() 時 provider 不得導航（react-router 的 Link 本來就這樣） */
export interface LinkComponentProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  ref?: Ref<HTMLAnchorElement>;
}

export type LinkComponent = ComponentType<LinkComponentProps>;

const LinkContext = createContext<LinkComponent | null>(null);

export function LinkProvider({ component, children }: { component: LinkComponent; children: ReactNode }) {
  return <LinkContext.Provider value={component}>{children}</LinkContext.Provider>;
}

/** 目前注入的連結元件；沒有 provider 時是 null */
export function useLinkComponent(): LinkComponent | null {
  return useContext(LinkContext);
}

export interface UiLinkProps extends LinkComponentProps {
  /** 站外網址：不經 provider，渲染成 <a target="_blank" rel="noopener">（另開分頁，07 第 9.3 節） */
  external?: boolean;
}

/** web-ui 內部唯一渲染 <a> 的地方（除了不可聚焦的停用形式） */
export function UiLink({ external, rel, children, ...rest }: UiLinkProps) {
  const provided = useContext(LinkContext);
  if (external || !provided)
    return (
      <a rel={external ? (rel ?? 'noopener') : rel} target={external ? '_blank' : undefined} {...rest}>
        {children}
      </a>
    );
  return createElement(provided, { rel, ...rest }, children);
}
