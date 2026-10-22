import { useEffect, useState } from 'react';
import refractCssUrl from '../styles/glass-refract.css?url';

// Tier 2：只在閘門判定為 refract（Chromium）時才插入折射樣式表與 SVG 濾鏡，Safari 永遠不解析（07 第 5.3 節）
export function RefractFilter() {
  const [on, setOn] = useState(() => document.documentElement.dataset.glass === 'refract');
  useEffect(() => {
    const obs = new MutationObserver(() => setOn(document.documentElement.dataset.glass === 'refract'));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-glass'] });
    return () => obs.disconnect();
  }, []);
  useEffect(() => {
    if (!on) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = refractCssUrl;
    link.dataset.ll = 'refract';
    document.head.appendChild(link);
    return () => link.remove();
  }, [on]);
  if (!on) return null;
  return (
    <svg className="ll-svg-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <filter id="ll-refract" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feImage href="/glass/refract-map.svg" preserveAspectRatio="none" result="map" />
        <feDisplacementMap in="SourceGraphic" in2="map" scale="18" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}
