// web-ui 的站內連結注入（站規 1.17）：Root 用 <LinkProvider component={RouterLink}> 包住頁面，web-ui 的 Button、BackButton、
// StatChip、TextLink 等元件的 href 都經過這裡交給 react-router 的 <Link>（client-side 導航，不整頁重新載入）。
// 站外網址（http、https、mailto、tel 或 //）用原生 <a rel="noopener">。這是全專案唯一可以匯入 react-router 的 Link 的檔案（站規 4.1 R1）。
import { Link } from 'react-router';
import type { LinkComponentProps } from '@ledgerland/web-ui';

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

export function RouterLink({ href, rel, ref, children, ...rest }: LinkComponentProps) {
  if (EXTERNAL.test(href))
    return (
      <a ref={ref} href={href} rel={rel ?? 'noopener'} {...rest}>
        {children}
      </a>
    );
  return (
    <Link ref={ref} to={href} rel={rel} {...rest}>
      {children}
    </Link>
  );
}
