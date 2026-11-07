// 會計公式（02 第 1.1 節的 /formulas/ 與 /formulas/<id>/，2026-11-07）：總覽的分組展開列、分類切換與搜尋寫回網址、條目頁的各段、相關題連到閱讀頁、
// 返回帶回搜尋、Tab 標示圖鑑、各入口、英文站。公式與題目一律從正在服務的快照讀，不寫死內容。
import { expect, test, type APIRequestContext } from '@playwright/test';
import { manifestOf } from './glossary-data.ts';
import { waitForApp } from './helpers.ts';

interface FormulaEntry {
  id: string;
  kind: 'ratio' | 'relation';
  category: string;
  label: string;
  aliases: string[];
  formula: string;
  termRef: string;
  ratioRef?: string;
  questionIds: string[];
}
interface FormulaDetail extends FormulaEntry {
  versions: { version: string; deck?: { code: string }; formula: string }[];
  components: { term?: string; label: string; meaning: string }[];
  sources: { id: string; code: string; title: string; slides: number[] }[];
  questions: Record<'formula' | 'numeric' | 'concept', { id: string; deck: string; topic: string }[]>;
  related: string[];
}

async function indexOf(request: APIRequestContext, locale: 'zh-TW' | 'en' = 'zh-TW'): Promise<FormulaEntry[]> {
  const m = await manifestOf(request);
  const res = await request.get(`/${m.formulaIndex![locale]}`);
  return (await res.json()) as FormulaEntry[];
}
async function detailsOf(request: APIRequestContext): Promise<FormulaDetail[]> {
  const m = await manifestOf(request);
  const res = await request.get(`/${m.formulaDetails!['zh-TW']}`);
  return (await res.json()) as FormulaDetail[];
}

test.describe('會計公式', () => {
  test('總覽：依分類收成展開列（只有第一類預設展開）、右上角是條目數；選一類與搜尋都寫回網址；搜尋別名也找得到', async ({ page, request }) => {
    const index = await indexOf(request);
    await page.goto('/formulas/');
    await waitForApp(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('會計公式');
    await expect(page.getByTestId('formulas-stat')).toContainText(String(index.length));
    const groups = page.locator('[data-testid^="formula-group-"]');
    expect(await groups.count()).toBeGreaterThan(3);
    await expect(groups.first()).toHaveAttribute('open', '');
    await expect(groups.nth(1)).not.toHaveAttribute('open', '');
    // 每一條都在某一組裡（總數相符）
    await expect(page.getByTestId('formula-row')).toHaveCount(index.length);
    // 搜尋：用一條有別名的公式的別名找，網址帶 ?q=
    const withAlias = index.find((f) => f.aliases.length > 0)!;
    const alias = withAlias.aliases[0]!;
    await page.getByTestId('formulas-search').fill(alias);
    await expect(page).toHaveURL(new RegExp(`\\?q=${encodeURIComponent(alias).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
    await expect(page.getByTestId('formula-row').filter({ hasText: withAlias.label })).toBeVisible();
    await page.getByTestId('formulas-search').fill('zzzzzz');
    await expect(page.getByTestId('formulas-empty')).toBeVisible();
    await page.getByTestId('formulas-empty').getByRole('button', { name: '清除搜尋' }).click();
    await expect(page.getByTestId('formulas-search')).toBeFocused();
    await expect(page).toHaveURL(/\/formulas\/$/);
    await expect(page.getByTestId('formula-groups')).toBeVisible();
    // 選一類：只剩那一類，網址帶 ?group=
    await page.getByRole('radiogroup', { name: '分類' }).getByRole('radio', { name: '獲利能力' }).click();
    await expect(page).toHaveURL(/\?group=profitability$/);
    await expect(page.getByTestId('formula-section-profitability')).toBeVisible();
    await expect(page.getByTestId('formula-row')).toHaveCount(index.filter((f) => f.category === 'profitability').length);
  });

  test('條目頁：公式一行、各版本、各項數值、範例、怎麼看、講義出處、三組相關題、相關公式與名詞連結；相關題連到閱讀頁；返回帶回搜尋', async ({
    page,
    request,
  }) => {
    const details = await detailsOf(request);
    // 挑一條有版本、有出處、三組題都有、有相關公式的（ROE 這類）
    const f = details.find(
      (d) => d.versions.length > 0 && d.sources.length > 0 && d.questions.formula.length > 0 && d.questions.concept.length > 0 && d.related.length > 0,
    )!;
    await page.goto(`/formulas/?q=${encodeURIComponent(f.label)}`);
    await waitForApp(page);
    await page.getByTestId('formula-row').filter({ hasText: f.label }).first().click();
    await waitForApp(page);
    await expect(page).toHaveURL(new RegExp(`/formulas/${f.id}/$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(f.label);
    await expect(page.getByTestId('formula-line')).toContainText(f.formula);
    await expect(page.locator('[data-testid="formula-versions"] dt')).toHaveCount(f.versions.length);
    const deckVersion = f.versions.find((v) => v.deck);
    if (deckVersion) await expect(page.getByTestId('formula-versions')).toContainText(`講義 ${deckVersion.deck!.code} 的寫法`);
    await expect(page.locator('[data-testid="formula-components"] dt')).toHaveCount(f.components.length);
    // 有名詞的項目是連到名詞頁的膠囊
    const termComponent = f.components.find((c) => c.term);
    if (termComponent) await expect(page.locator(`[data-testid="formula-components"] a[href$="/terms/${termComponent.term}/"]`)).toBeVisible();
    await expect(page.getByTestId('formula-example')).toBeVisible();
    await expect(page.getByTestId('formula-reading')).toBeVisible();
    // 範例的佔位符都已換成數字（沒有 {{ 留在畫面上）
    await expect(page.getByTestId('formula-example')).not.toContainText('{{');
    await expect(page.getByTestId('formula-sources')).toContainText(`講義 ${f.sources[0]!.code}`);
    await expect(page.getByTestId('formula-sources')).toContainText(`第 ${f.sources[0]!.slides.join('、')} 頁`);
    const total = f.questions.formula.length + f.questions.numeric.length + f.questions.concept.length;
    await expect(page.getByTestId('formula-questions')).toContainText(`相關題目（${total} 題）`);
    await expect(page.getByTestId('formula-questions-formula')).toHaveAttribute('open', '');
    await expect(page.getByTestId('formula-questions-concept')).not.toHaveAttribute('open', '');
    await expect(page.getByTestId('formula-related').locator('a')).toHaveCount(f.related.length);
    await expect(page.getByTestId('formula-term')).toHaveAttribute('href', `/terms/${f.termRef}/`);
    // 相關題連到背題瀏覽的閱讀頁（題目的講義與 ID）
    const q = f.questions.formula[0]!;
    await page.getByTestId('formula-questions-formula').getByTestId('formula-question').first().click();
    await waitForApp(page);
    await expect(page).toHaveURL(new RegExp(`/exam/browse/\\?deck=${q.deck}&q=${q.id}$`));
    await expect(page.getByTestId('exam-reader')).toContainText(q.topic);
    // 回到條目頁再按返回：帶回原本的搜尋
    await page.goBack();
    await waitForApp(page);
    await page.getByTestId('formula-back').click();
    await waitForApp(page);
    await expect(page).toHaveURL(new RegExp(`/formulas/\\?q=${encodeURIComponent(f.label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
    // 不存在的公式是找不到頁面
    await page.goto('/formulas/fm_zzzzzzzz/');
    await waitForApp(page);
    await expect(page.getByTestId('not-found')).toBeVisible();
  });

  test('公式題組：公式頁的「練習相關題目」開一輪只有這些題的練習，標題是公式名、返回回公式頁，答完的回饋與總結卡都連回公式；閱讀頁有「相關公式」膠囊；作答中的模擬考沒有', async ({
    page,
    request,
  }) => {
    const details = await detailsOf(request);
    const f = details.find((d) => d.questions.formula.length > 0 && d.questions.concept.length > 0)!;
    const total = f.questions.formula.length + f.questions.numeric.length + f.questions.concept.length;
    await page.goto(`/formulas/${f.id}/`);
    await waitForApp(page);
    await expect(page.getByTestId('formula-practise')).toHaveText(`練習相關題目（${total} 題）`);
    await page.getByTestId('formula-practise').click();
    await waitForApp(page);
    await expect(page).toHaveURL(new RegExp(`/exam/formula:${f.id}/$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`公式：${f.label}`);
    await expect(page.getByRole('link', { name: '回到公式' })).toHaveAttribute('href', `/formulas/${f.id}/`);
    const card = page.locator('.ll-exam-question');
    await expect(card).toContainText(`第 1 題，共 ${total} 題`);
    // 答一題：回饋的解析下面有「相關公式」膠囊，連回這條公式
    await card.getByRole('radio').first().check();
    await card.getByRole('button', { name: '確認答案' }).click();
    const pills = page.getByTestId('formula-pills');
    await expect(pills).toBeVisible();
    await expect(pills.locator(`a[href$="/formulas/${f.id}/"]`)).toHaveText(f.label);
    // 閱讀頁：解析下面也有膠囊
    const q = f.questions.formula[0]!;
    await page.goto(`/exam/browse/?deck=${q.deck}&q=${q.id}`);
    await waitForApp(page);
    await expect(page.getByTestId('exam-reader').getByTestId('formula-pills').locator(`a[href$="/formulas/${f.id}/"]`)).toBeVisible();
    // 模擬考作答中沒有膠囊
    await page.goto('/exam/mock/');
    await waitForApp(page);
    await page.getByTestId('exam-mock-start').click();
    await expect(page.locator('.ll-exam-question')).toBeVisible();
    await expect(page.getByTestId('formula-pills')).toHaveCount(0);
    // 沒有題的公式題組不會炸：不存在的公式是「沒有這一組題目」
    await page.goto('/exam/formula:fm_zzzzzzzz/');
    await waitForApp(page);
    await expect(page.getByText('沒有這一組題目')).toBeVisible();
  });

  test('Tab 標示圖鑑；入口：圖鑑、首頁捷徑、「我的」、苦練首頁；英文站的標題與分類是英文', async ({ page, request }) => {
    const index = await indexOf(request, 'en');
    await page.goto('/formulas/');
    await waitForApp(page);
    await expect(page.getByRole('navigation', { name: '主要導覽' }).getByRole('link', { name: '圖鑑' })).toHaveAttribute('aria-current', 'page');
    await page.goto('/terms/');
    await waitForApp(page);
    await expect(page.getByTestId('terms-formulas-row')).toHaveAttribute('href', '/formulas/');
    await page.goto('/');
    await waitForApp(page);
    await expect(page.getByTestId('home-formulas-row')).toHaveAttribute('href', '/formulas/');
    await page.goto('/me/');
    await waitForApp(page);
    await expect(page.getByTestId('me-formulas-row')).toHaveAttribute('href', '/formulas/');
    await page.goto('/exam/');
    await waitForApp(page);
    await expect(page.getByTestId('exam-more-formulas')).toHaveAttribute('href', '/formulas/');
    await page.goto('/en/formulas/');
    await waitForApp(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Formulas');
    const firstRow = (await page.getByTestId('formula-row').first().innerText()).split('\n')[0]!;
    expect(index.map((f) => f.label)).toContain(firstRow);
    await page.goto(`/en/formulas/${index[0]!.id}/`);
    await waitForApp(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(index[0]!.label);
    await expect(page.getByTestId('formula-back')).toHaveAttribute('href', '/en/formulas/');
  });
});
