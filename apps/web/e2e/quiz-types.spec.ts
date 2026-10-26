// M3 其餘五種題型的作答頁（03 第 2.4 節表二）：five_step_fill、ratio_numeric、ratio_interpret、judgment、journal_entry。
// 內容快照還沒有這幾種題目，所以用 page.route 把 content-manifest 加一關、關卡檔換成自編的測試資料（形狀同 tools/lib/content-snapshot.mjs），
// 數字與情境都是自編的。鍵盤流程只在 Chromium 跑；iphone-webkit 跑觸控版（點選與輸入）與 axe。
// five_step_fill、ratio_numeric、journal_entry 由 scoring.ts 把 compiled.cells、compiled.ratio、compiled.expectedEntries 組進 ScoreContext 判分（2026-10-24 起計分），
// 這裡也驗證逐格、逐行的回饋與摘要；元件層的細節在 packages/web-ui 的元件測試裡。
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { waitForApp } from './helpers.ts';

// 這個檔的測試都用 page.route 換掉內容；page.route 攔不到 Service Worker 處理的請求，第二次整頁導覽可能拿到 precache 裡的 manifest（quiz-13）
test.use({ serviceWorkers: 'block' });

const LEVEL_ID = 'lv_e2etyp01';
/** 結果頁標題：一顆星以上「完成了！」，沒有星星「這次還沒拿到星星」（M3 驗收第 5 輪）；這裡只驗證走得到結果頁，不看答對幾題 */
const RESULT_TITLE = /^(完成了！|這次還沒拿到星星)$/;
const FILE = 'lv_e2etyp01.e2e.json';

const base = {
  chapterId: 'ch_e2e001',
  objectiveId: 'obj_e2e01',
  difficulty: 1,
  rev: 1,
  revKind: 'text',
  answerRev: 1,
  termRefs: [],
  tags: [],
  status: 'published',
};
const scenario = {
  opening: { balances: { cash: 400000, share_capital: 400000 } },
  events: [{ id: 'e1', template: 'tpl.purchase_inventory_cash', params: { amount: 150000 } }],
  policy: 'teacher@1',
  layout: 'teacher@1',
  window: 'cumulative',
  targets: [],
};

const QUESTIONS = [
  {
    ...base,
    id: 'q_e2efive1',
    type: 'five_step_fill',
    scored: true,
    prompt: '店用現金 {{money:e1.amount}} 買進存貨。請填入兩個勾稽點的數字。',
    scenario,
    openCells: ['cf_pretax_income', 'bs_cash'],
    explanation: '兩邊的數字要一樣。',
    compiled: { expected: {}, values: { 'e1.amount': 150000 }, cells: { cf_pretax_income: 0, bs_cash: 250000 } },
  },
  {
    ...base,
    id: 'q_e2eratio',
    type: 'ratio_numeric',
    scored: true,
    prompt: '負債總額 {{money:vars.liabilities}}、資產總計 {{money:vars.assets}}，負債比率是多少？',
    vars: { liabilities: 100000, assets: 400000 },
    compute: { ratioRef: 'debt_ratio@excel', measures: { bs_total_liabilities: 'vars.liabilities', bs_total_assets: 'vars.assets' } },
    answerUnit: 'percent',
    decimals: 2,
    tolerance: 0.01,
    // 04 第 16.1 節：ratio_numeric 的答案以 target ID answer 引用；快照只有 compiled.ratio，前端由 exact 推出 expected.answer.value
    explanation: '負債總額 ÷ 資產總計 ＝ {{percent:expected.answer.value}}。',
    compiled: { ratio: { ratioRef: 'debt_ratio@excel', status: 'ok', exact: { num: '1', den: '4' }, displayValue: 25 } },
  },
  {
    ...base,
    id: 'q_e2einter',
    type: 'ratio_interpret',
    scored: true,
    prompt: '看上面的指標，哪一句解讀最合理？',
    ratioRef: 'debt_ratio@excel',
    options: [
      { id: 'o_e2ea', text: '每四元資產裡有一元是借來的', feedback: '負債比率 25% 就是這個意思。' },
      { id: 'o_e2eb', text: '店已經資不抵債', feedback: '負債只佔四分之一，離資不抵債很遠。' },
      { id: 'o_e2ec', text: '店沒有任何負債', feedback: '25% 不是 0。' },
    ],
    correctOptionId: 'o_e2ea',
    explanation: '負債比率是負債總額佔資產總計的比例。',
    compiled: { ratios: [{ ratioRef: 'debt_ratio@excel', status: 'ok', exact: { num: '1', den: '4' }, displayValue: 25 }] },
  },
  {
    ...base,
    id: 'q_e2ejudge',
    type: 'judgment',
    scored: false,
    prompt: '只能先看一張報表，你會先看哪一張？三個選擇都說得通。',
    options: [
      { id: 'o_e2ej1', text: '先看損益表', upside: '看得到怎麼賺的。', downside: '看不到現金夠不夠。' },
      { id: 'o_e2ej2', text: '先看資產負債表', upside: '看得到欠多少。', downside: '只是一天的快照。' },
      { id: 'o_e2ej3', text: '先看現金流量表', upside: '現金騙不了人。', downside: '分不出賺的還是借的。' },
    ],
    viewpoint: '三張一起看才看得到全貌。',
    attribution: 'site',
    explanation: '這一題沒有標準答案。',
  },
  {
    ...base,
    id: 'q_e2ejrnl1',
    type: 'journal_entry',
    scored: true,
    prompt: '店用現金 {{money:e1.amount}} 買進存貨，分錄怎麼寫？',
    scenario: { ...scenario, window: 'transaction' },
    accountChoices: ['cash', 'inventory', 'accounts_payable', 'revenue'],
    explanation: '借存貨、貸現金。',
    compiled: {
      expected: {},
      values: { 'e1.amount': 150000 },
      expectedEntries: [
        { account: 'inventory', side: 'debit', amount: 150000 },
        { account: 'cash', side: 'credit', amount: 150000 },
      ],
    },
  },
];

const LEVEL = {
  level: { id: LEVEL_ID, rev: 1, chapterId: base.chapterId, order: 1, title: '五種題型測試關', questionIds: QUESTIONS.map((q) => q.id), status: 'published' },
  questions: QUESTIONS,
};

/** 把測試關卡接進 manifest，關卡檔由 route 直接回 JSON；level 可以換成同形狀的變體（窄螢幕測試給指標計算題加上名詞） */
async function installFixture(page: Page, level: { level: typeof LEVEL.level; questions: readonly unknown[] } = LEVEL): Promise<void> {
  await page.route('**/content/content-manifest.json', async (route) => {
    const res = await route.fetch();
    const json = (await res.json()) as { levels?: unknown[] };
    json.levels = [
      ...(json.levels ?? []),
      {
        id: LEVEL_ID,
        chapterId: base.chapterId,
        order: 99,
        questionIds: LEVEL.level.questionIds,
        files: { 'zh-TW': `content/zh-TW/${FILE}`, en: `content/en/${FILE}` },
      },
    ];
    await route.fulfill({ response: res, json });
  });
  await page.route(`**/content/*/${FILE}`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(level) }));
}

async function clearProgress(page: Page): Promise<void> {
  await page.goto('/');
  await waitForApp(page);
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    await Promise.all(
      dbs.map(
        (d) =>
          new Promise<void>((resolve) => {
            if (!d.name) return resolve();
            const req = indexedDB.deleteDatabase(d.name);
            req.onsuccess = req.onerror = req.onblocked = () => resolve();
          }),
      ),
    );
    localStorage.clear();
  });
}

function card(page: Page): Locator {
  return page.locator('.ll-question');
}

/** 等某一題整張畫好：整頁的布幕掀開（第一題齊了才 data-ready="true"），換題後作答區齊了題目卡才顯示（.ll-question-wrap），全程沒有骨架 */
async function questionReady(page: Page, index: number): Promise<void> {
  await expect(page.locator('.ll-page[data-ready="true"]')).toBeVisible();
  await expect(page.getByText(`第 ${index} 題，共 5 題`)).toBeVisible();
  await expect(page.locator('.ll-question-wrap[data-ready="true"]')).toBeVisible();
  await expect(card(page).locator('.ll-skeleton')).toHaveCount(0);
}

async function submitByKeyboard(page: Page): Promise<void> {
  const button = page.getByRole('button', { name: '確認答案' });
  await expect(button).toBeEnabled();
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.ll-feedback__title')).toBeFocused();
}

async function nextByKeyboard(page: Page): Promise<void> {
  const next = page.getByRole('button', { name: '下一題' });
  await next.focus();
  await page.keyboard.press('Enter');
}

async function noSeriousAxe(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
  const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

test.describe('M3 題型（純鍵盤，Chromium）', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', '鍵盤流程只在 Chromium 專案跑一次');

  test('五步驟勾稽、指標計算、指標判讀、取捨、借貸分錄', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await clearProgress(page);
    await installFixture(page);
    await page.goto(`/level/${LEVEL_ID}/`);
    await waitForApp(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('五種題型測試關');

    // 1 五步驟勾稽填格：每格一個數字框，標籤含勾稽點與哪一邊；全部填了才能確認；Enter 送出
    await questionReady(page, 1);
    const submit = page.getByRole('button', { name: '確認答案' });
    await expect(submit).toBeDisabled();
    const cfCell = page.getByRole('textbox', { name: '步驟②（勾稽點 A），現金流量表的稅前淨利' });
    const bsCell = page.getByRole('textbox', { name: '步驟③（勾稽點 C），資產負債表的現金及約當現金' });
    await expect(cfCell).toHaveAttribute('inputmode', 'decimal');
    await expect(cfCell.locator('xpath=..').getByRole('button', { name: '切換正負號' })).toBeVisible();
    await cfCell.focus();
    await page.keyboard.type('0');
    await expect(submit).toBeDisabled();
    await bsCell.focus();
    await page.keyboard.type('250000');
    await expect(page.getByText(/系統讀到：.*250,000/)).toBeVisible();
    await expect(submit).toBeEnabled();
    await noSeriousAxe(page);
    await page.keyboard.press('Enter');
    await expect(page.locator('.ll-feedback__title')).toBeFocused();
    // 逐格判分：兩格都相符，摘要是填對 2 格
    await expect(page.locator('.ll-feedback__title')).toHaveText(/答對了/);
    await expect(page.locator('.ll-fivestep__light.is-ok')).toHaveCount(2);
    await expect(page.getByText('填對 2 格，共 2 格。')).toBeVisible();
    await nextByKeyboard(page);

    // 2 指標計算：數字框加單位、「±」、N/A 切換（aria-pressed，按下時停用並說明），「看公式」可展開
    await questionReady(page, 2);
    const ratioInput = card(page).getByRole('textbox');
    await expect(ratioInput).toHaveAttribute('inputmode', 'decimal');
    await expect(card(page).getByText('%', { exact: true })).toBeVisible();
    await ratioInput.focus();
    await page.keyboard.type('25');
    await expect(page.getByText('系統讀到：25.00%')).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: '切換正負號' })).toBeFocused();
    await page.keyboard.press('Space');
    await expect(ratioInput).toHaveValue('-25');
    // 「±」按下後焦點回到數字框（游標回原位），再 Tab 一次才回到按鈕
    await expect(ratioInput).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Space');
    await expect(ratioInput).toHaveValue('25');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const na = page.getByRole('button', { name: 'N/A，分母不存在' });
    await expect(na).toBeFocused();
    await expect(na).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('Space');
    await expect(na).toHaveAttribute('aria-pressed', 'true');
    await expect(ratioInput).toBeDisabled();
    await expect(page.getByText(/已選 N\/A/)).toBeVisible();
    await page.keyboard.press('Space');
    await expect(na).toHaveAttribute('aria-pressed', 'false');
    await expect(ratioInput).toBeEnabled();
    await page.keyboard.press('Tab');
    const formula = page.locator('details.ll-ratio-numeric__formula');
    await expect(formula.locator('summary')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(formula).toHaveAttribute('open', '');
    await expect(formula.getByText(/負債總額 ÷ 資產總計/)).toBeVisible();
    await expect(formula.getByText('本題採Excel 口徑')).toBeVisible();
    await submitByKeyboard(page);
    // 25% 在容差內：答對，摘要列出你的答案與正解
    await expect(page.locator('.ll-feedback__title')).toHaveText(/答對了/);
    await expect(page.locator('.ll-ratio-numeric.is-correct')).toBeVisible();
    await expect(page.getByText(/你的答案是 25\.00%，正解是 25\.00%/)).toBeVisible();
    // 解說裡的 {{percent:expected.answer.value}} 取精確值 1/4，顯示為 25.00%（QA 第 2 輪：以前是空白）
    await expect(page.locator('.ll-feedback').getByText('負債總額 ÷ 資產總計 ＝ 25.00%。')).toBeVisible();
    await nextByKeyboard(page);

    // 3 指標判讀：上方是真正的 table（有欄列表頭），下方同單選
    await questionReady(page, 3);
    const table = page.getByRole('table', { name: '這一題的指標' });
    await expect(table).toBeVisible();
    await expect(table.getByRole('columnheader', { name: '指標' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: '數值' })).toBeVisible();
    await expect(table.getByRole('rowheader')).toHaveCount(1);
    await expect(table.getByRole('cell', { name: '25.00%' })).toBeVisible();
    await expect(table.getByRole('cell', { name: 'Excel 口徑' })).toBeVisible();
    const target = card(page).getByRole('radio', { name: /每四元資產/ });
    await card(page).getByRole('radio').first().focus();
    for (let i = 0; i < 3 && !(await target.isChecked()); i++) await page.keyboard.press('ArrowDown');
    await expect(target).toBeChecked();
    await submitByKeyboard(page);
    await expect(page.locator('.ll-feedback__title')).toHaveText(/答對了/);
    await nextByKeyboard(page);

    // 4 取捨：同單選；確認後三個方案都展開、沒有 ✓ ✗、標題「解說觀點」、摘要「已顯示三個方案的解說觀點」、有「收藏」
    await questionReady(page, 4);
    const first = card(page).getByRole('radio').first();
    await first.focus();
    await page.keyboard.press('Space');
    await expect(first).toBeChecked();
    await submitByKeyboard(page);
    const title = page.locator('.ll-feedback__title');
    await expect(title).toHaveText('解說觀點');
    const described = await title.getAttribute('aria-describedby');
    expect(described).toBeTruthy();
    await expect(page.locator(`[id="${described!}"]`)).toHaveText('已顯示三個方案的解說觀點。');
    await expect(page.getByText('好處')).toHaveCount(3);
    await expect(page.getByText('要注意')).toHaveCount(3);
    await expect(card(page).locator('.ll-option__status')).toHaveCount(0);
    await expect(card(page).locator('.ll-option.is-correct-selected, .ll-option.is-wrong-selected')).toHaveCount(0);
    const favourite = page.getByRole('button', { name: '收藏' });
    await expect(favourite).toHaveAttribute('aria-pressed', 'false');
    await favourite.focus();
    await page.keyboard.press('Enter');
    // 切換按鈕：文字固定「收藏」，按下後 aria-pressed 變 true（站規 2.4.1）
    await expect(favourite).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('這一題不計分，也不進錯題本。')).toBeVisible();
    await noSeriousAxe(page);
    await nextByKeyboard(page);

    // 5 借貸分錄：「新增一行」開啟可搜尋、依要素分組的面板；每行 select 加數字框；分錄是 table
    await questionReady(page, 5);
    await expect(page.getByRole('button', { name: '確認答案' })).toBeDisabled();
    const add = page.getByRole('button', { name: '新增一行' });
    await add.focus();
    await page.keyboard.press('Enter');
    await expect(add).toHaveAttribute('aria-expanded', 'true');
    const search = page.getByRole('searchbox', { name: '搜尋科目' });
    await expect(search).toBeFocused();
    await expect(page.getByRole('group', { name: '資產' })).toBeVisible();
    await expect(page.getByRole('group', { name: '負債' })).toBeVisible();
    await page.keyboard.type('存貨');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: '存貨' })).toBeFocused();
    await page.keyboard.press('Enter');
    const side1 = page.getByRole('combobox', { name: '第 1 行的借或貸' });
    await expect(side1).toBeFocused();
    await expect(side1).toHaveValue('debit');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('textbox', { name: '第 1 行的金額' })).toBeFocused();
    await page.keyboard.type('150000');
    await expect(page.getByRole('rowheader', { name: '第 1 行' })).toBeVisible();
    await expect(page.getByText(/借貸不平衡，差 .*150,000/)).toBeVisible();
    await add.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.type('現金');
    // 搜尋框在作答表單裡：直接按 Enter（iOS 鍵盤的「搜尋」）選第一個結果；第 1 行已經填好也不會把分錄送出（quiz-21）
    await page.keyboard.press('Enter');
    await expect(page.locator('.ll-feedback__title')).toHaveCount(0);
    const side2 = page.getByRole('combobox', { name: '第 2 行的借或貸' });
    await expect(side2).toBeFocused();
    await expect(side2).toHaveValue('credit');
    await page.keyboard.press('Tab');
    await page.keyboard.type('150000');
    await expect(page.getByText('借貸平衡')).toBeVisible();
    await expect(page.getByRole('table', { name: '分錄' }).getByRole('columnheader', { name: '科目' })).toBeVisible();
    await expect(page.getByText(/不是分錄裡的科目/)).toBeVisible();
    await noSeriousAxe(page);
    await submitByKeyboard(page);
    // 借存貨、貸現金各 150,000 與核心的正解一致：兩行都正確、沒有少了的行
    await expect(page.locator('.ll-feedback__title')).toHaveText(/答對了/);
    await expect(page.locator('.ll-journal__row.is-correct')).toHaveCount(2);
    await expect(page.locator('.ll-journal__missing')).toHaveCount(0);
    await expect(page.getByText('分錄全部正確。')).toBeVisible();
    await nextByKeyboard(page);
    await expect(page.getByTestId('result-title')).toHaveText(RESULT_TITLE);
    expect(errors).toEqual([]);
  });
});

// 整關不計分的關卡（延伸章的取捨題；關卡快照 level.unscored）：結果頁是「已讀完這一關」，沒有星星與正確率
const UNSCORED_LEVEL_ID = 'lv_e2eunsc1';
const UNSCORED_FILE = 'lv_e2eunsc1.e2e.json';
const judgment = (id: string, prompt: string) => ({
  ...base,
  id,
  type: 'judgment',
  scored: false,
  prompt,
  options: [
    { id: `o_${id.slice(-4)}a`, text: '先看損益表', upside: '看得到怎麼賺的。', downside: '看不到現金夠不夠。' },
    { id: `o_${id.slice(-4)}b`, text: '先看資產負債表', upside: '看得到欠多少。', downside: '只是一天的快照。' },
  ],
  viewpoint: '兩張一起看才完整。',
  attribution: 'site',
  explanation: '這一題沒有標準答案。',
});
const UNSCORED_LEVEL = {
  level: {
    id: UNSCORED_LEVEL_ID,
    rev: 1,
    chapterId: base.chapterId,
    order: 2,
    title: '利害關係人的視角',
    questionIds: ['q_e2eun001', 'q_e2eun002'],
    status: 'published',
    unscored: true,
  },
  questions: [judgment('q_e2eun001', '身為債權人，你會先看哪一張？'), judgment('q_e2eun002', '身為股東，你會先看哪一張？')],
};

async function installUnscoredFixture(page: Page): Promise<void> {
  await page.route('**/content/content-manifest.json', async (route) => {
    const res = await route.fetch();
    const json = (await res.json()) as { levels?: unknown[] };
    json.levels = [
      ...(json.levels ?? []),
      {
        id: UNSCORED_LEVEL_ID,
        chapterId: base.chapterId,
        order: 98,
        questionIds: UNSCORED_LEVEL.level.questionIds,
        files: { 'zh-TW': `content/zh-TW/${UNSCORED_FILE}`, en: `content/en/${UNSCORED_FILE}` },
      },
    ];
    await route.fulfill({ response: res, json });
  });
  await page.route(`**/content/*/${UNSCORED_FILE}`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(UNSCORED_LEVEL) }),
  );
}

test.describe('不計分的關卡', () => {
  test('兩題取捨題走完：結果頁是「已讀完這一關」、沒有星星與正確率，進度只記完成', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await clearProgress(page);
    await installUnscoredFixture(page);
    await page.goto(`/level/${UNSCORED_LEVEL_ID}/`);
    await waitForApp(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('利害關係人的視角');
    for (const i of [1, 2]) {
      await expect(page.getByText(`第 ${i} 題，共 2 題`)).toBeVisible();
      await card(page).getByRole('radio').first().check();
      await page.getByRole('button', { name: '確認答案' }).click();
      await expect(page.locator('.ll-feedback__title')).toHaveText('解說觀點');
      await page.getByRole('button', { name: '下一題' }).click();
    }
    await expect(page.getByTestId('result-title')).toHaveText('已讀完這一關');
    await expect(page.getByTestId('result-title')).toBeFocused();
    await expect(page.getByText('這一關的題目沒有標準答案，不算星星，也不會進錯題本。')).toBeVisible();
    await expect(page.getByTestId('result-ratio')).toHaveCount(0);
    await expect(page.getByRole('img', { name: /顆星/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '再看一次' })).toBeVisible();
    await expect(page.getByRole('link', { name: '回到地圖' })).toHaveAttribute('href', `/play/?from=${UNSCORED_LEVEL_ID}`);
    // 進度：這一關記成已完成但 0 顆星，錯題本沒有東西
    const progress = await page.evaluate(async (levelId) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('ledgerland');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const read = <T>(storeName: string, key?: string) =>
        new Promise<T>((resolve, reject) => {
          const tx = db.transaction(storeName, 'readonly').objectStore(storeName);
          const req = key === undefined ? tx.getAll() : tx.get(key);
          req.onsuccess = () => resolve(req.result as T);
          req.onerror = () => reject(req.error);
        });
      const level = await read<{ stars: number; firstCompletedAt?: string } | undefined>('levelProgress', levelId);
      const reviews = await read<unknown[]>('reviewQueue');
      db.close();
      return { level, reviews: reviews.length };
    }, UNSCORED_LEVEL_ID);
    expect(progress.level?.stars).toBe(0);
    expect(progress.level?.firstCompletedAt).toBeTruthy();
    expect(progress.reviews).toBe(0);
    expect(errors).toEqual([]);
  });
});

test.describe('M3 題型（觸控與點選）', () => {
  test('五種題型都能以點選與輸入作答到結果頁', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await clearProgress(page);
    await installFixture(page);
    await page.goto(`/level/${LEVEL_ID}/`);
    await waitForApp(page);
    await questionReady(page, 1);
    await page.getByRole('textbox', { name: '步驟②（勾稽點 A），現金流量表的稅前淨利' }).fill('0');
    await page.getByRole('textbox', { name: '步驟③（勾稽點 C），資產負債表的現金及約當現金' }).fill('250000');
    await page.getByRole('button', { name: '確認答案' }).click();
    await expect(page.locator('.ll-feedback__title')).toBeFocused();
    await page.getByRole('button', { name: '下一題' }).click();

    await questionReady(page, 2);
    await page.getByRole('button', { name: 'N/A，分母不存在' }).click();
    await expect(card(page).getByRole('textbox')).toBeDisabled();
    await page.getByRole('button', { name: '確認答案' }).click();
    // 正解是 25%，按 N/A 算錯；摘要仍列出正解
    await expect(page.locator('.ll-ratio-numeric.is-wrong')).toBeVisible();
    await expect(page.getByText(/你的答案是 N\/A，正解是 25\.00%/)).toBeVisible();
    await page.getByRole('button', { name: '下一題' }).click();

    await questionReady(page, 3);
    await expect(page.getByRole('table', { name: '這一題的指標' })).toBeVisible();
    await card(page)
      .getByRole('radio', { name: /每四元資產/ })
      .check();
    await page.getByRole('button', { name: '確認答案' }).click();
    await expect(page.locator('.ll-feedback__title')).toHaveText(/答對了/);
    await page.getByRole('button', { name: '下一題' }).click();

    await questionReady(page, 4);
    await card(page).getByRole('radio').first().check();
    await page.getByRole('button', { name: '確認答案' }).click();
    await expect(page.locator('.ll-feedback__title')).toHaveText('解說觀點');
    await expect(page.getByRole('button', { name: '收藏' })).toBeVisible();
    await page.getByRole('button', { name: '下一題' }).click();

    await questionReady(page, 5);
    await page.getByRole('button', { name: '新增一行' }).click();
    await page.getByRole('button', { name: '存貨' }).click();
    await page.getByRole('textbox', { name: '第 1 行的金額' }).fill('150000');
    await page.getByRole('button', { name: '新增一行' }).click();
    await page.getByRole('searchbox', { name: '搜尋科目' }).fill('現金');
    await page.getByRole('button', { name: '現金', exact: false }).first().click();
    await page.getByRole('combobox', { name: '第 2 行的借或貸' }).selectOption('credit');
    await page.getByRole('textbox', { name: '第 2 行的金額' }).fill('150000');
    await expect(page.getByText('借貸平衡')).toBeVisible();
    await page.getByRole('button', { name: '確認答案' }).click();
    await expect(page.locator('.ll-feedback__title')).toBeFocused();
    await page.getByRole('button', { name: '下一題' }).click();
    await expect(page.getByTestId('result-title')).toHaveText(RESULT_TITLE);
    expect(errors).toEqual([]);
  });
});

// 窄螢幕（07 第 8.4 節：320px 寬可完整使用）：每一題作答前後整頁都沒有水平溢出；借貸分錄的表格在有名稱的 region 裡水平捲動，
// 「新增一行」與「確認答案」不被蓋住；指標計算的數字框、%、±、N/A 允許換行。獨立按鈕與作答後的名詞 chip 至少 44×44（2026-10-24 規劃者決定 3）。
// 指標計算題加上一個真實的名詞（負債比率，內容快照裡五個欄位都有），順便檢查名詞卡每個欄位各在自己的標題底下。
const DEBT_RATIO_TERM = 'tm_9e1rb64c';
const NARROW_LEVEL = {
  ...LEVEL,
  questions: QUESTIONS.map((q) => (q.id === 'q_e2eratio' ? { ...q, termRefs: [DEBT_RATIO_TERM] } : q)),
};

async function expectNoHorizontalOverflow(page: Page, where: string): Promise<void> {
  const { scrollWidth, clientWidth, culprits } = await page.evaluate(() => {
    const cw = document.documentElement.clientWidth;
    // 失敗時列出右緣超出視窗的元素（可捲動容器裡的也列，absolute 的元素可能逃出容器的裁切），方便找原因
    const culprits = [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((el) => el.getBoundingClientRect().right > cw + 0.5)
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} right=${Math.round(el.getBoundingClientRect().right)}`);
    return { scrollWidth: document.documentElement.scrollWidth, clientWidth: cw, culprits };
  });
  expect(scrollWidth, `${where}：整頁不應該有水平溢出（${culprits.join('、')}）`).toBeLessThanOrEqual(clientWidth);
}

async function expectTarget(locator: Locator, name: string): Promise<void> {
  const box = await locator.boundingBox();
  expect(box, name).not.toBeNull();
  expect(box!.width, `${name} 的寬`).toBeGreaterThanOrEqual(44);
  expect(box!.height, `${name} 的高`).toBeGreaterThanOrEqual(44);
}

/** 按鈕的中心點真的點得到它自己（沒有被表格或其他元素蓋住） */
async function expectNotCovered(locator: Locator, name: string): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  const hit = await locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return top !== null && (top === el || el.contains(top));
  });
  expect(hit, `${name} 沒有被蓋住`).toBe(true);
}

for (const width of [320, 360, 375]) {
  test.describe(`窄螢幕 ${width}px`, () => {
    test.use({ viewport: { width, height: 740 } });

    test('五種題型作答前後都沒有水平溢出；分錄表格在 region 裡捲動；觸控目標至少 44×44', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await clearProgress(page);
      await installFixture(page, NARROW_LEVEL);
      await page.goto(`/level/${LEVEL_ID}/`);
      await waitForApp(page);

      // 1 五步驟
      await questionReady(page, 1);
      await expectNoHorizontalOverflow(page, '五步驟作答前');
      await page.getByRole('textbox', { name: '步驟②（勾稽點 A），現金流量表的稅前淨利' }).fill('0');
      await page.getByRole('textbox', { name: '步驟③（勾稽點 C），資產負債表的現金及約當現金' }).fill('250000');
      await page.getByRole('button', { name: '確認答案' }).click();
      await expect(page.locator('.ll-feedback__title')).toBeFocused();
      await expectNoHorizontalOverflow(page, '五步驟作答後');
      await page.getByRole('button', { name: '下一題' }).click();

      // 2 指標計算：數字框、%、±、N/A 都在卡片裡（允許換行）
      await questionReady(page, 2);
      await expectNoHorizontalOverflow(page, '指標計算作答前');
      const cardBox = (await card(page).boundingBox())!;
      for (const name of ['切換正負號', 'N/A，分母不存在']) {
        const button = card(page).getByRole('button', { name });
        await expectTarget(button, name);
        const box = (await button.boundingBox())!;
        expect(box.x + box.width, `${name} 在卡片裡`).toBeLessThanOrEqual(cardBox.x + cardBox.width + 0.5);
      }
      await card(page).getByRole('textbox').fill('25');
      await page.getByRole('button', { name: '確認答案' }).click();
      await expect(page.locator('.ll-feedback__title')).toBeFocused();
      await expectNoHorizontalOverflow(page, '指標計算作答後');
      // 作答後的名詞 chip 列：獨立目標，至少 44×44
      const chip = page.locator('.ll-feedback__terms').getByRole('button', { name: '名詞卡：負債比率' });
      await expectTarget(chip, '作答後的名詞 chip');
      // 名詞卡：用語說明、公式、例子、常見誤解、IFRS 各在自己的標題底下（note 不放在「例子」）
      await chip.click();
      const sheet = page.getByRole('dialog', { name: '負債比率' });
      await expect(sheet).toBeVisible();
      const heads = await sheet.locator('.ll-sheet__section h3').allInnerTexts();
      expect(heads.slice(0, 5)).toEqual(['用語說明', '公式', '例子', '常見誤解', 'IFRS 怎麼處理']);
      const noteText = await sheet.locator('.ll-sheet__section').nth(0).locator('p').first().innerText();
      await expect(sheet.locator('.ll-sheet__section').nth(2)).not.toContainText(noteText);
      await expectNoHorizontalOverflow(page, '名詞卡');
      await page.keyboard.press('Escape');
      await expect(sheet).toHaveCount(0);
      // 關閉後焦點回到開啟它的 chip（07 第 8.1 節，quiz-10、quiz-18）
      await expect(chip).toBeFocused();
      // 鍵盤開啟、按右上角的「關閉」：焦點同樣回到 chip
      await chip.focus();
      await page.keyboard.press('Enter');
      await expect(sheet).toBeVisible();
      await sheet.getByRole('button', { name: '關閉' }).first().click();
      await expect(sheet).toHaveCount(0);
      await expect(chip).toBeFocused();
      await page.getByRole('button', { name: '下一題' }).click();

      // 3 指標判讀
      await questionReady(page, 3);
      await expectNoHorizontalOverflow(page, '指標判讀作答前');
      await card(page)
        .getByRole('radio', { name: /每四元資產/ })
        .check();
      await page.getByRole('button', { name: '確認答案' }).click();
      await expectNoHorizontalOverflow(page, '指標判讀作答後');
      await page.getByRole('button', { name: '下一題' }).click();

      // 4 取捨：收藏按鈕至少 44×44
      await questionReady(page, 4);
      await expectNoHorizontalOverflow(page, '取捨作答前');
      await card(page).getByRole('radio').first().check();
      await page.getByRole('button', { name: '確認答案' }).click();
      await expectTarget(page.getByRole('button', { name: '收藏', exact: true }), '收藏按鈕');
      await expectNoHorizontalOverflow(page, '取捨作答後');
      await page.getByRole('button', { name: '下一題' }).click();

      // 5 借貸分錄：表格在 region 裡水平捲動，整頁不變寬；刪除鈕至少 44×44；「新增一行」「確認答案」沒有被蓋住
      await questionReady(page, 5);
      await expectNoHorizontalOverflow(page, '分錄作答前');
      await page.getByRole('button', { name: '新增一行' }).click();
      await page.getByRole('button', { name: '應付帳款' }).click();
      await page.getByRole('textbox', { name: '第 1 行的金額' }).fill('150000');
      await page.getByRole('button', { name: '新增一行' }).click();
      await page.getByRole('searchbox', { name: '搜尋科目' }).fill('現金');
      await page.getByRole('button', { name: '現金', exact: false }).first().click();
      await page.getByRole('textbox', { name: '第 2 行的金額' }).fill('150000');
      const region = page.getByRole('region', { name: '分錄表格' });
      await expect(region).toBeVisible();
      await expect(region).toHaveAttribute('tabindex', '0');
      await expect(region.getByRole('table', { name: '分錄' })).toBeVisible();
      await expectNoHorizontalOverflow(page, '分錄填寫中');
      // 科目欄不被擠成一字一行：「應付帳款」只佔一行
      const accountLine = region.locator('.ll-journal__account > span').first();
      const lineHeight = await accountLine.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight) || 24);
      expect((await accountLine.boundingBox())!.height).toBeLessThan(lineHeight * 1.5);
      await expectTarget(page.getByRole('button', { name: '刪除第 1 行' }), '刪除第 1 行');
      // 借貸下拉至少 44px 高（quiz-20：WebKit 的原生外觀會忽略 min-height，所以拿掉 appearance 自己畫箭頭）
      await expectTarget(page.getByRole('combobox', { name: '第 1 行的借或貸' }), '第 1 行的借或貸');
      await expectNotCovered(page.getByRole('button', { name: '新增一行' }), '新增一行');
      await expectNotCovered(page.getByRole('button', { name: '確認答案' }), '確認答案');
      await page.getByRole('button', { name: '確認答案' }).click();
      await expect(page.locator('.ll-feedback__title')).toBeFocused();
      await expectNoHorizontalOverflow(page, '分錄作答後');
      await page.getByRole('button', { name: '下一題' }).click();
      await expect(page.getByTestId('result-title')).toHaveText(RESULT_TITLE);
      await expectNoHorizontalOverflow(page, '結果頁');
      expect(errors).toEqual([]);
    });
  });
}

// 英文交易影響題的三段方向（quiz-19）：320 到 375px 不溢出，三個選項排成等寬三格（窄時符號在上、文字在下），英文單字不被切成兩半
for (const width of [320, 360, 375]) {
  test.describe(`交易影響題英文 ${width}px`, () => {
    test.use({ viewport: { width, height: 740 }, serviceWorkers: 'block' });

    test('三段方向在列裡排成三格，沒有水平溢出', async ({ page }) => {
      await clearProgress(page);
      await installOneQuestion(page, 'lv_gtpyj3s8', 'q_59v8fm8w');
      await page.goto(`/en/level/${ONE_ID}/`);
      await waitForApp(page);
      await expect(page.getByText('Question 1 of 1')).toBeVisible();
      const rows = page.locator('.ll-impact__row');
      // 交易影響題的元件延後載入（骨架先出現），等第一列畫出來再量
      await expect(rows.first().locator('.ll-seg__item').first()).toBeVisible();
      await expectNoHorizontalOverflow(page, '交易影響題英文作答前');
      const count = await rows.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        const row = rows.nth(i);
        const rowBox = (await row.boundingBox())!;
        const items = row.locator('.ll-seg__item');
        await expect(items).toHaveCount(3);
        const boxes = await items.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect));
        // 三格同一列、等寬，都在這一列裡面
        expect(new Set(boxes.map((b) => Math.round(b.top))).size, '三格在同一列').toBe(1);
        for (const b of boxes) {
          expect(b.right, '選項在列裡').toBeLessThanOrEqual(rowBox.x + rowBox.width + 0.5);
          expect(b.height, '選項至少 44px 高').toBeGreaterThanOrEqual(44);
        }
        // 單字不被切開：每個選項的文字寬度不超過自己的格子
        const overflow = await items.evaluateAll((els) => els.filter((el) => el.scrollWidth > el.clientWidth + 1).length);
        expect(overflow, '選項文字沒有超出格子').toBe(0);
      }
      await rows
        .first()
        .getByRole('radio', { name: /Increase/ })
        .check();
      await expectNoHorizontalOverflow(page, '交易影響題英文選了之後');
    });
  });
}

// 真實內容的單題測試關（quiz-9、quiz-11、quiz-16、quiz-17）：從 e2e 建置的關卡檔取出一題，接成只有一題的測試關，不必先答完前面的題目
const ONE_ID = 'lv_e2eone01';
const ONE_FILE = 'lv_e2eone01.e2e.json';

interface ManifestLevel {
  id: string;
  chapterId: string;
  order?: number;
  questionIds?: string[];
  files: Record<string, string>;
}

async function installOneQuestion(page: Page, sourceLevelId: string, questionId: string): Promise<void> {
  const sources: Partial<Record<string, string>> = {};
  await page.route('**/content/content-manifest.json', async (route) => {
    const res = await route.fetch();
    const json = (await res.json()) as { levels?: ManifestLevel[] };
    const src = json.levels?.find((l) => l.id === sourceLevelId);
    if (src === undefined) throw new Error(`manifest 裡沒有 ${sourceLevelId}`);
    Object.assign(sources, src.files);
    const one: ManifestLevel = {
      id: ONE_ID,
      chapterId: src.chapterId,
      order: 98,
      questionIds: [questionId],
      files: { 'zh-TW': `content/zh-TW/${ONE_FILE}`, en: `content/en/${ONE_FILE}` },
    };
    json.levels = [...(json.levels ?? []), one];
    await route.fulfill({ response: res, json });
  });
  await page.route(`**/content/*/${ONE_FILE}`, async (route) => {
    const locale = route.request().url().includes('/content/en/') ? 'en' : 'zh-TW';
    const path = sources[locale];
    if (path === undefined) throw new Error(`還沒讀到 ${sourceLevelId} 的 ${locale} 關卡檔路徑`);
    const res = await route.fetch({ url: new URL(`/${path}`, route.request().url()).toString() });
    const real = (await res.json()) as { level: Record<string, unknown>; questions: { id: string }[] };
    const q = real.questions.find((x) => x.id === questionId);
    if (q === undefined) throw new Error(`${sourceLevelId} 裡沒有 ${questionId}`);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ level: { ...real.level, id: ONE_ID, questionIds: [questionId] }, questions: [q] }),
    });
  });
}

async function answerFirstChoice(page: Page): Promise<void> {
  await expect(page.getByText('第 1 題，共 1 題')).toBeVisible();
  await card(page).getByRole('radio').first().check();
  await page.getByRole('button', { name: '確認答案' }).click();
  await expect(page.locator('.ll-feedback__title')).toBeFocused();
}

test.describe('真實內容的名詞與指標名稱', () => {
  test('名詞卡的「用語說明」把 {{raw:…}} 換成文字（中英文）；關閉後焦點回到 chip', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await clearProgress(page);
    await installOneQuestion(page, 'lv_cy9yzrq2', 'q_wswww6ex');
    await page.goto(`/level/${ONE_ID}/`);
    await waitForApp(page);
    await answerFirstChoice(page);
    const chip = page.locator('.ll-feedback__terms').getByRole('button', { name: '名詞卡：稅前淨利' });
    await chip.click();
    const sheet = page.getByRole('dialog', { name: '稅前淨利' });
    await expect(sheet).toBeVisible();
    const note = sheet.locator('.ll-sheet__section').filter({ has: page.getByRole('heading', { name: '用語說明' }) });
    await expect(note).toContainText('2027');
    await expect(note).not.toContainText('{{');
    await expect(sheet).not.toContainText('{{');
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(chip).toBeFocused();

    // 英文：已確認的作答從暫存還原，名詞卡一樣沒有大括號
    await page.waitForTimeout(600);
    await page.goto(`/en/level/${ONE_ID}/`);
    await waitForApp(page);
    const enChip = page.locator('.ll-feedback__terms').getByRole('button', { name: 'Term card: Profit before tax' });
    await enChip.click();
    const enSheet = page.getByRole('dialog', { name: 'Profit before tax' });
    await expect(enSheet).toBeVisible();
    await expect(enSheet).toContainText('2027');
    await expect(enSheet).not.toContainText('{{');
    await enSheet.getByRole('button', { name: 'Close' }).first().click();
    await expect(enSheet).toHaveCount(0);
    await expect(enChip).toBeFocused();
    expect(errors).toEqual([]);
  });

  test('名詞索引讀不到時 chip 點了照樣打開名詞卡；恢復連線後 chip 顯示名詞名稱，不是 tm_ ID', async ({ page }) => {
    await clearProgress(page);
    await installOneQuestion(page, 'lv_cy9yzrq2', 'q_wswww6ex');
    const index = /\/content\/zh-TW\/term-index\.[0-9a-f]+\.json$/;
    await page.route(index, (route) => route.fulfill({ status: 404, body: '' }));
    await page.goto(`/level/${ONE_ID}/`);
    await waitForApp(page);
    await answerFirstChoice(page);
    const chip = page.locator('.ll-feedback__terms').getByRole('button').first();
    await expect(chip).toHaveAccessibleName(/tm_z971merj/);
    await chip.click();
    // 名詞卡不依賴索引：完整內容讀得到就打開
    const sheet = page.getByRole('dialog', { name: '稅前淨利' });
    await expect(sheet).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await page.unroute(index);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(page.locator('.ll-feedback__terms').getByRole('button', { name: '名詞卡：稅前淨利' })).toBeVisible();
  });

  test('分類題的指標卡顯示指標名稱，不顯示內部代號（中英文）', async ({ page }) => {
    await clearProgress(page);
    // 第 8 章「指標的分類」第 1 關的第 1 題就是指標類別的分類題
    await page.goto('/level/lv_mfwe0xsm/');
    await waitForApp(page);
    await expect(page.locator('.ll-classify__pool')).toBeVisible();
    const cards = page.locator('.ll-classify__pool').getByRole('button');
    await expect(cards.first()).toBeVisible();
    const texts = await cards.allInnerTexts();
    expect(texts.length).toBeGreaterThan(0);
    for (const text of texts) expect(text, '卡片文字不是 ID').not.toMatch(/[a-z]+_[a-z_]+/);
    expect(texts.join('、')).toContain('負債比率');
    await page.goto('/en/level/lv_mfwe0xsm/');
    await waitForApp(page);
    await expect(page.locator('.ll-classify__pool')).toBeVisible();
    const enTexts = await page.locator('.ll-classify__pool').getByRole('button').allInnerTexts();
    for (const text of enTexts) expect(text, 'card text is not an ID').not.toMatch(/[a-z]+_[a-z_]+/);
    expect(enTexts.join(', ')).toContain('Debt ratio');
  });

  test('天數題輸入「36.50天」讀得懂：「系統讀到」用天、不顯示讀不懂的提示，判分讀到 36.5（quiz-14）', async ({ page }) => {
    await clearProgress(page);
    await installOneQuestion(page, 'lv_c0hxq2zv', 'q_03nrdkrk');
    await page.goto(`/level/${ONE_ID}/`);
    await waitForApp(page);
    await expect(page.locator('.ll-page[data-ready="true"]')).toBeVisible();
    await expect(page.getByText('第 1 題，共 1 題')).toBeVisible();
    await card(page).getByRole('textbox').first().fill('36.50天');
    await expect(card(page).getByText('系統讀到：36.5 天')).toBeVisible();
    await expect(card(page).getByText(/這不是可以判讀的數字/)).toHaveCount(0);
    await page.getByRole('button', { name: '確認答案' }).click();
    await expect(page.locator('.ll-feedback__title')).toBeFocused();
    await expect(page.locator('.ll-feedback')).toContainText('36.5');
  });

  test('交易影響題的指標目標顯示指標名稱，不顯示 current_ratio@excel（中英文）', async ({ page }) => {
    await clearProgress(page);
    await installOneQuestion(page, 'lv_fjndp8nf', 'q_kcyeeh16');
    await page.goto(`/level/${ONE_ID}/`);
    await waitForApp(page);
    await expect(card(page).getByRole('radiogroup', { name: '流動比率的變動方向' })).toBeVisible();
    await expect(card(page)).not.toContainText('current_ratio');
    await page.goto(`/en/level/${ONE_ID}/`);
    await waitForApp(page);
    await expect(card(page).getByRole('radiogroup', { name: /Current ratio/i })).toBeVisible();
    await expect(card(page)).not.toContainText('current_ratio');
  });
});
