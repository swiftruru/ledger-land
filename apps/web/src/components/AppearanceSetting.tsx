// 「我的 › 設定 › 外觀」（16 第 7 節）：外觀分段控制（跟隨系統、淺色、深色）；目前生效是深色時多一組「深色風味」；
// 降低透明度與折射效果開關（07 第 7.1 節）。偏好只存在 localStorage。
import { useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { Segmented } from '@ledgerland/web-ui';
import { readFlavor, readGlass, readTheme, setFlavor, setGlass, setTheme, type Flavor, type GlassPref, type ThemePref } from '../lib/prefs.ts';

/** 目前生效的主題與風味（boot 腳本寫在 html 上），屬性改變時重新繪製 */
export function useResolvedTheme() {
  const get = () => ({
    theme: document.documentElement.dataset.theme ?? 'light',
    flavor: document.documentElement.dataset.flavor ?? 'violet',
    glass: document.documentElement.dataset.glass ?? 'solid',
  });
  const [state, setState] = useState(get);
  useEffect(() => {
    const obs = new MutationObserver(() => setState(get()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-flavor', 'data-glass'] });
    return () => obs.disconnect();
  }, []);
  return state;
}

export function AppearanceSetting() {
  const { t } = useLingui();
  const [pref, setPref] = useState<ThemePref>(readTheme);
  const [flavor, setFlavorState] = useState<Flavor>(readFlavor);
  const [glass, setGlassState] = useState<GlassPref>(readGlass);
  const resolved = useResolvedTheme();
  return (
    <div className="ll-settings">
      <p className="ll-small ll-muted" id="ll-theme-label">
        {t({ id: 'settings.theme.label', message: '外觀' })}
      </p>
      <Segmented
        value={pref}
        labelledBy="ll-theme-label"
        onChange={(v) => {
          setTheme(v);
          setPref(v);
        }}
        options={[
          { value: 'system', label: t({ id: 'settings.theme.system', message: '跟隨系統' }) },
          { value: 'light', label: t({ id: 'settings.theme.light', message: '淺色' }) },
          { value: 'dark', label: t({ id: 'settings.theme.dark', message: '深色' }) },
        ]}
      />
      {resolved.theme === 'dark' && (
        <>
          <p className="ll-small ll-muted" id="ll-flavor-label">
            {t({ id: 'settings.flavor.label', message: '深色風味' })}
          </p>
          <Segmented
            value={flavor}
            labelledBy="ll-flavor-label"
            onChange={(v) => {
              setFlavor(v);
              setFlavorState(v);
            }}
            options={[
              {
                value: 'violet',
                label: (
                  <>
                    <span className="ll-dot ll-dot--violet" aria-hidden="true" />
                    {t({ id: 'settings.flavor.violet', message: '夜空' })}
                  </>
                ),
              },
              {
                value: 'berry',
                label: (
                  <>
                    <span className="ll-dot ll-dot--berry" aria-hidden="true" />
                    {t({ id: 'settings.flavor.berry', message: '莓果' })}
                  </>
                ),
              },
              {
                value: 'wine',
                label: (
                  <>
                    <span className="ll-dot ll-dot--wine" aria-hidden="true" />
                    {t({ id: 'settings.flavor.wine', message: '紅酒' })}
                  </>
                ),
              },
            ]}
          />
        </>
      )}
      <p className="ll-small ll-muted" id="ll-glass-label">
        {t({ id: 'settings.glass.label', message: '玻璃效果' })}
      </p>
      <Segmented
        value={glass}
        labelledBy="ll-glass-label"
        onChange={(v) => {
          setGlass(v);
          setGlassState(v);
        }}
        options={[
          { value: 'auto', label: t({ id: 'settings.glass.auto', message: '自動' }) },
          { value: 'reduced', label: t({ id: 'settings.glass.reduced', message: '降低透明度' }) },
          { value: 'frost', label: t({ id: 'settings.glass.frost', message: '霧面' }) },
          { value: 'refract', label: t({ id: 'settings.glass.refract', message: '折射' }) },
        ]}
      />
      <p className="ll-small ll-muted">
        {t({
          id: 'settings.glass.hint',
          message: '如果你在 iPhone 開了「降低透明度」，網頁讀不到這個設定，請在這裡選「降低透明度」。折射只在電腦版的 Chromium 瀏覽器有效。',
        })}
      </p>
    </div>
  );
}
