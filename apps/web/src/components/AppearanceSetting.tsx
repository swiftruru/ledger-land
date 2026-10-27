// 「我的 › 設定 › 外觀」（16 第 7 節）：外觀分段控制（跟隨系統、淺色、深色）；目前生效是深色時多一組「深色風味」；
// 降低透明度與折射效果開關（07 第 7.1 節）。偏好只存在 localStorage。卡片標題與小標的樣式在 styles/me.css（設定頁）。
// 第 4 輪看圖驗收：375 時「玻璃效果」放不下一列、被元件排成格子。420 以下設定頁的分段控制改成較小的字與內距（me.css）；
// 英文的選項改成 Auto、Solid、Frosted、Refraction（原本 Automatic、Reduce transparency 在 375 只能排成一欄四列），說明文字寫出 Solid 對應 iPhone 的 Reduce Transparency。
// 風味的色票（第 1 輪看圖驗收）：16px 圓角方塊，左上是該風味的底色（bg）、右下是它的標誌色（border-strong，三種色相差最多），
// 加 1.5px 外框，在任何主題都看得出是三種不同的夜色；實心的方塊，不像 radio。顏色是 tokens 產生的 --ll-swatch-<風味>-bg 與 -mark（唯一來源，不寫死色碼）。
import { useLingui } from '@lingui/react/macro';
import { useEffect, useState, type CSSProperties } from 'react';
import { Segmented } from '@ledgerland/web-ui';
import { readFlavor, readGlass, readTheme, setFlavor, setGlass, setTheme, type Flavor, type GlassPref, type ThemePref } from '../lib/prefs.ts';

function Swatch({ flavor }: { flavor: Flavor }) {
  const style = { '--_sw-a': `var(--ll-swatch-${flavor}-bg)`, '--_sw-b': `var(--ll-swatch-${flavor}-mark)` } as CSSProperties;
  return <span className="ll-flavor-swatch" style={style} aria-hidden="true" />;
}

const readResolved = () => ({
  theme: document.documentElement.dataset.theme ?? 'light',
  flavor: document.documentElement.dataset.flavor ?? 'violet',
  glass: document.documentElement.dataset.glass ?? 'solid',
});

/** 目前生效的主題與風味（boot 腳本寫在 html 上），屬性改變時重新繪製 */
export function useResolvedTheme() {
  const [state, setState] = useState(readResolved);
  useEffect(() => {
    const obs = new MutationObserver(() => setState(readResolved()));
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
      <h2 className="ll-settings__title" id="ll-theme-label">
        {t({ id: 'settings.theme.label', message: '外觀' })}
      </h2>
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
          <p className="ll-settings__label" id="ll-flavor-label">
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
                    <Swatch flavor="violet" />
                    {t({ id: 'settings.flavor.violet', message: '夜空' })}
                  </>
                ),
              },
              {
                value: 'berry',
                label: (
                  <>
                    <Swatch flavor="berry" />
                    {t({ id: 'settings.flavor.berry', message: '莓果' })}
                  </>
                ),
              },
              {
                value: 'wine',
                label: (
                  <>
                    <Swatch flavor="wine" />
                    {t({ id: 'settings.flavor.wine', message: '紅酒' })}
                  </>
                ),
              },
            ]}
          />
        </>
      )}
      <p className="ll-settings__label" id="ll-glass-label">
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
          { value: 'auto', label: t({ id: 'settings.glass.auto', message: '自動', comment: '玻璃效果的選項：自動（英文用短字 Auto）' }) },
          {
            value: 'reduced',
            label: t({
              id: 'settings.glass.reduced',
              message: '降低透明度',
              comment:
                '玻璃效果的選項：降低透明度（和 iPhone 的設定同名）。英文用 Solid，和 Frosted、Refraction 同一種說法，375 寬時四個選項排得進一列；說明文字寫出它對應 iPhone 的 Reduce Transparency',
            }),
          },
          { value: 'frost', label: t({ id: 'settings.glass.frost', message: '霧面' }) },
          { value: 'refract', label: t({ id: 'settings.glass.refract', message: '折射' }) },
        ]}
      />
      <p className="ll-settings__hint">
        {t({
          id: 'settings.glass.hint',
          message: '如果你在 iPhone 開了「降低透明度」，網頁讀不到這個設定，請在這裡選「降低透明度」。折射只在電腦版的 Chromium 瀏覽器有效。',
        })}
      </p>
    </div>
  );
}
