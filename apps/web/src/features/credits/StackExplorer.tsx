// 幕後頁的技術棧探索器：六層的方塊板（每個方塊是設計系統的 Button，切換式，aria-pressed），選一個就在「那一層的正下方」開一張面板說它負責什麼、和誰搭配
// （2026-10-27 維護者實機回饋：面板固定放在六層最下面時，手機上點了還要往下滑才看得到；沒選時面板在最上面只放提示）；
// 搭配的方塊外層加虛線框，面板裡同時有文字清單，不靠顏色辨認。面板裡的「搭配」是小按鈕，按了就換選取。
// 兩個彩蛋住在面板裡：tokens 的三種深色風味（三種都看過才算找到）、PWA 的「現在拔掉網路也能開嗎」。
// 沒有動畫、沒有新的可點元件種類（07 第 9.3 節的表不用改）；樣式在 styles/info.css 的 .ll-stack。
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Badge, Button, Card, Segmented } from '@ledgerland/web-ui';
import { type EggId } from './eggs.ts';
import { STACK_LAYERS, nodeById, nodesInLayer, relatedOf, versionOf, type StackLayer, type StackNode } from './stack.ts';

const PANEL_ID = 'll-stack-panel';

type Flavor = 'violet' | 'berry' | 'wine';
const FLAVORS: readonly Flavor[] = ['violet', 'berry', 'wine'];

/** 每一層與每個節點的文字（Lingui 的字串要在 hook 裡取） */
function useStackLabels(): { layer: Record<StackLayer, string>; role: Record<string, string>; name: Record<string, string> } {
  const { t } = useLingui();
  return {
    // 不是專有名詞的兩個方塊名稱要翻譯；其他方塊用 stack.ts 的 name
    name: {
      fonts: t({ id: 'stack.node.fonts.name', message: '系統字型', comment: '技術棧方塊的名稱（不是專有名詞，要翻譯）' }),
      lint: t({ id: 'stack.node.lint.name', message: 'oxlint 與 Prettier', comment: '技術棧方塊的名稱（兩個工具名，中間的連接詞要翻譯）' }),
    },
    layer: {
      ui: t({ id: 'stack.layer.ui', message: '畫面', comment: '技術棧的分層標題：畫面層（React、設計系統、色票、字串）' }),
      app: t({ id: 'stack.layer.app', message: '頁面與狀態', comment: '技術棧的分層標題：路由與狀態' }),
      data: t({ id: 'stack.layer.data', message: '內容與進度', comment: '技術棧的分層標題：內容、會計核心、進度儲存' }),
      build: t({ id: 'stack.layer.build', message: '建置', comment: '技術棧的分層標題：建置工具' }),
      platform: t({ id: 'stack.layer.platform', message: '安裝與主機', comment: '技術棧的分層標題：PWA 與主機' }),
      quality: t({ id: 'stack.layer.quality', message: '把關', comment: '技術棧的分層標題：測試與檢查' }),
    },
    role: {
      react: t({ id: 'stack.node.react.role', message: '畫面的骨架。每一頁都是用它拼出來的元件，資料一變畫面就跟著變。', comment: '技術棧節點的角色說明' }),
      'web-ui': t({
        id: 'stack.node.web-ui.role',
        message: '自家的設計系統：按鈕、選單列、面板、徽章全站只有這一套，所以每個可以點的東西長得都一樣。',
        comment: '技術棧節點的角色說明',
      }),
      tokens: t({
        id: 'stack.node.tokens.role',
        message: '顏色、字級、間距、圓角、動態的唯一來源，建置時變成 CSS 變數。淺色一套，深色有夜空、莓果、紅酒三種口味。',
        comment: '技術棧節點的角色說明',
      }),
      lingui: t({
        id: 'stack.node.lingui.role',
        message: '中英兩種語言的字串都走它；語言寫在網址裡，切換不會弄丟作答中的題目。',
        comment: '技術棧節點的角色說明',
      }),
      icons: t({ id: 'stack.node.icons.role', message: '線條圖示。建置時直接寫進頁面，不另外發請求，也不用字型檔。', comment: '技術棧節點的角色說明' }),
      fonts: t({
        id: 'stack.node.fonts.role',
        message: '不下載任何字型，用你裝置本來就有的字；數字用等寬數字，報表才對得齊。',
        comment: '技術棧節點的角色說明',
      }),
      router: t({ id: 'stack.node.router.role', message: '決定網址對到哪一頁，每一頁的程式只在需要時才載入。', comment: '技術棧節點的角色說明' }),
      zustand: t({
        id: 'stack.node.zustand.role',
        message: '作答中的狀態放在這裡，不綁在網址上，所以切換語言或回上一頁都不會重來。',
        comment: '技術棧節點的角色說明',
      }),
      idb: t({ id: 'stack.node.idb.role', message: '瀏覽器內建資料庫的小包裝。你的進度就存在這裡，不上任何伺服器。', comment: '技術棧節點的角色說明' }),
      progress: t({
        id: 'stack.node.progress.role',
        message: '進度的資料模型：星星、錯題本、名詞收集、徽章。每一筆寫入都先排隊，頁面突然關掉也補得回來。',
        comment: '技術棧節點的角色說明',
      }),
      zod: t({ id: 'stack.node.zod.role', message: '檢查資料長得對不對：內容在建置時驗一次，備份匯入時再驗一次。', comment: '技術棧節點的角色說明' }),
      core: t({
        id: 'stack.node.core.role',
        message: '會計核心：過帳、三表、指標、五步驟檢查。金額一律整數，不會有一塊錢的差。',
        comment: '技術棧節點的角色說明',
      }),
      quiz: t({ id: 'stack.node.quiz.role', message: '判分：每一種題型怎麼算對、算幾顆星，都在這裡。', comment: '技術棧節點的角色說明' }),
      content: t({
        id: 'stack.node.content.role',
        message: '章節、關卡、題目、名詞都是 JSON 檔，建置時驗證、算好答案、切成一份份快照，裝好之後離線也能整章作答。',
        comment: '技術棧節點的角色說明',
      }),
      vite: t({ id: 'stack.node.vite.role', message: '把原始碼打包成瀏覽器能跑的檔案，順手把每一頁拆成小塊。', comment: '技術棧節點的角色說明' }),
      lightningcss: t({ id: 'stack.node.lightningcss.role', message: '處理 CSS：壓縮、補上舊版 iOS 需要的前綴。', comment: '技術棧節點的角色說明' }),
      typescript: t({
        id: 'stack.node.typescript.role',
        message: '型別。套件之間只准往一個方向依賴，會計核心不碰畫面，檢查不過就不能合併。',
        comment: '技術棧節點的角色說明',
      }),
      pnpm: t({ id: 'stack.node.pnpm.role', message: '管套件。只用發布滿兩週的版本，每一條例外都要留紀錄。', comment: '技術棧節點的角色說明' }),
      node: t({ id: 'stack.node.node.role', message: '建置與測試在它上面跑；網站本身不需要伺服器。', comment: '技術棧節點的角色說明' }),
      pwa: t({ id: 'stack.node.pwa.role', message: '可以加到主畫面、離線也能開。有新版本時會問你，不會偷偷換掉。', comment: '技術棧節點的角色說明' }),
      cloudflare: t({
        id: 'stack.node.cloudflare.role',
        message: '放靜態檔案的主機。深層網址一律回到網站本身，少了的檔案老實回 404。',
        comment: '技術棧節點的角色說明',
      }),
      csp: t({
        id: 'stack.node.csp.role',
        message: '內容安全政策：只能載入自己的程式，沒有 eval，公式是先剖析成語法樹再算。',
        comment: '技術棧節點的角色說明',
      }),
      analytics: t({
        id: 'stack.node.analytics.role',
        message: '沒有 cookie 的流量統計，只在正式網站、畫面閒下來才載入，失敗就算了。',
        comment: '技術棧節點的角色說明',
      }),
      zxing: t({ id: 'stack.node.zxing.role', message: '掃課堂 QR 用的解碼器，在背景執行緒裡跑，只有按下掃描才載入。', comment: '技術棧節點的角色說明' }),
      vitest: t({ id: 'stack.node.vitest.role', message: '單元測試，兩千多條；元件的測試直接在 WebKit 裡跑。', comment: '技術棧節點的角色說明' }),
      playwright: t({ id: 'stack.node.playwright.role', message: '用三種瀏覽器真的把網站點一遍，順便跑無障礙檢查。', comment: '技術棧節點的角色說明' }),
      lighthouse: t({ id: 'stack.node.lighthouse.role', message: '每次改動都量一次速度與體積，超過預算就不准合併。', comment: '技術棧節點的角色說明' }),
      lint: t({ id: 'stack.node.lint.role', message: '程式碼的排版與寫法檢查，連「不准出現裸露的超連結」和台灣用語都在管。', comment: '技術棧節點的角色說明' }),
    },
  };
}

/** tokens 節點的彩蛋：三種深色口味的小樣本 */
function FlavourSample({ onSeenAll }: { onSeenAll: () => void }) {
  const { t } = useLingui();
  const [flavor, setFlavor] = useState<Flavor>('violet');
  const [seen, setSeen] = useState<ReadonlySet<Flavor>>(() => new Set<Flavor>(['violet']));
  const labels: Record<Flavor, string> = {
    violet: t({ id: 'settings.flavor.violet', message: '夜空' }),
    berry: t({ id: 'settings.flavor.berry', message: '莓果' }),
    wine: t({ id: 'settings.flavor.wine', message: '紅酒' }),
  };
  const choose = (f: Flavor) => {
    setFlavor(f);
    const next = new Set(seen).add(f);
    setSeen(next);
    if (FLAVORS.every((x) => next.has(x))) onSeenAll();
  };
  // 色樣是裝飾（aria-hidden），意思在旁邊那句話；兩個方塊是那個口味的底色與記號色（tokens 的 --ll-swatch-*，設定頁的風味選單也用同一組）
  const name = labels[flavor];
  const style = { '--_sample-bg': `var(--ll-swatch-${flavor}-bg)`, '--_sample-mark': `var(--ll-swatch-${flavor}-mark)` } as CSSProperties;
  return (
    <div className="ll-stack__egg" data-testid="egg-flavours">
      <Segmented<Flavor>
        value={flavor}
        onChange={choose}
        size="sm"
        label={t({ id: 'eggs.flavour.hint', message: '試試三種深色口味', comment: '幕後頁 tokens 面板裡的風味切換（彩蛋）' })}
        options={FLAVORS.map((f) => ({ value: f, label: labels[f] }))}
      />
      <p className="ll-credits-sample" style={style} data-flavor={flavor}>
        <span className="ll-credits-sample__swatches" aria-hidden="true">
          <span className="ll-credits-sample__bg" />
          <span className="ll-credits-sample__mark" />
        </span>
        {t({ id: 'eggs.flavour.sample', message: `這是「${name}」的底色和記號色。`, comment: '風味樣本裡的一句話；name 是口味名' })}
      </p>
    </div>
  );
}

/** PWA 節點的彩蛋：問瀏覽器現在離線能不能開 */
function OfflineCheck({ onChecked }: { onChecked: () => void }) {
  const { t } = useLingui();
  const [result, setResult] = useState<'ready' | 'noSw' | null>(null);
  const check = () => {
    const hasSw = typeof navigator !== 'undefined' && navigator.serviceWorker?.controller !== null && navigator.serviceWorker?.controller !== undefined;
    setResult(hasSw ? 'ready' : 'noSw');
    onChecked();
  };
  return (
    <div className="ll-stack__egg" data-testid="egg-offline">
      <Button variant="secondary" size="sm" onClick={check}>
        <Trans id="eggs.offline.name" comment="幕後頁 PWA 面板裡的彩蛋按鈕">
          現在拔掉網路也能開嗎？
        </Trans>
      </Button>
      {result !== null && (
        <p className="ll-small" role="status" data-testid="egg-offline-result">
          {result === 'ready'
            ? t({
                id: 'eggs.offline.ready',
                message: '可以。Service Worker 已經把這一頁存好了，離線也讀得到。',
                comment: '彩蛋：有 Service Worker 時的回答',
              })
            : t({
                id: 'eggs.offline.noSw',
                message: '這個環境還沒有 Service Worker（開發模式或瀏覽器不支援），正式網站才會先存好。',
                comment: '彩蛋：沒有 Service Worker 時的回答',
              })}
        </p>
      )}
    </div>
  );
}

export function StackExplorer({ onEgg }: { onEgg: (id: EggId) => void }) {
  const { t } = useLingui();
  const labels = useStackLabels();
  const [selected, setSelected] = useState<string | null>(null);
  const node = selected === null ? undefined : nodeById(selected);
  const related = selected === null ? new Set<string>() : relatedOf(selected);
  const versionWord = t({ id: 'stack.version', message: '版本', comment: '方塊上版本號前面給螢幕閱讀器唸的字' });
  const toggle = (id: string) => setSelected((cur) => (cur === id ? null : id));

  const renderNode = (n: StackNode) => {
    const v = versionOf(n);
    return (
      <li key={n.id} className="ll-stack__item" data-related={related.has(n.id) ? 'true' : undefined}>
        <Button
          variant="secondary"
          size="md"
          pressed={selected === n.id}
          aria-controls={PANEL_ID}
          onClick={() => toggle(n.id)}
          data-testid={`stack-node-${n.id}`}
        >
          <span className="ll-stack__name">{labels.name[n.id] ?? n.name}</span>
          {v !== undefined && (
            <span className="ll-stack__ver ll-num">
              <span className="ll-sr-only">{versionWord} </span>
              {v}
            </span>
          )}
        </Button>
      </li>
    );
  };

  // 面板放在被選方塊那一層的正下方；換了一層時面板的 DOM 位置會變，選取後把它捲進畫面（nearest：放得下就不捲，底部留 Tab bar 的高度，見 info.css 的 scroll-margin）
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected !== null) panelRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const panel = (
    <Card className="ll-stack__panel" id={PANEL_ID} aria-live="polite" data-testid="stack-panel" ref={panelRef}>
      {node === undefined ? (
        <p className="ll-muted">
          <Trans id="stack.hint" comment="還沒選方塊時面板裡的提示">
            點一個方塊，看看它負責什麼。
          </Trans>
        </p>
      ) : (
        <>
          <h3 className="ll-stack__panel-title">
            {labels.name[node.id] ?? node.name}
            {versionOf(node) !== undefined && (
              <Badge kind="neutral" className="ll-num">
                {versionOf(node)}
              </Badge>
            )}
          </h3>
          <p>{labels.role[node.id] ?? ''}</p>
          {related.size > 0 && (
            <>
              <p className="ll-small ll-muted">
                <Trans id="stack.related" comment="面板裡「搭配」清單的小標">
                  搭配
                </Trans>
              </p>
              <ul className="ll-stack__chips" data-testid="stack-related">
                {[...related].map((id) => {
                  const r = nodeById(id);
                  return r === undefined ? null : (
                    <li key={id}>
                      <Button variant="quiet" size="sm" onClick={() => setSelected(id)} data-testid={`stack-chip-${id}`}>
                        {labels.name[r.id] ?? r.name}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {node.egg === 'flavours' && <FlavourSample onSeenAll={() => onEgg('flavours')} />}
          {node.egg === 'offline' && <OfflineCheck onChecked={() => onEgg('offline')} />}
        </>
      )}
    </Card>
  );

  return (
    <div className="ll-stack" data-testid="stack">
      {node === undefined && panel}
      {STACK_LAYERS.map((layer) => (
        <section key={layer} className="ll-stack__layer" aria-labelledby={`ll-stack-layer-${layer}`}>
          <h3 id={`ll-stack-layer-${layer}`} className="ll-stack__title">
            {labels.layer[layer]}
          </h3>
          <ul className="ll-stack__nodes">{nodesInLayer(layer).map(renderNode)}</ul>
          {node?.layer === layer && panel}
        </section>
      ))}
    </div>
  );
}
