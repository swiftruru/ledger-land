// 期中考苦練（M4c，02 第 1.1 節）：首頁與「我的」的入口、苦練首頁的統計與按鈕、練一段（答對與答錯的回饋、講義順序的字母、總結卡、只練錯過的）、
// 沿用上次與重新開始、打亂選項時確認後的講義字母、B/C 都對那一題是任一正確、老師審核頁的統計與篩選、noindex、英文站的介面英文而題目中文。
// 題目內容從建置好的快照讀（content-manifest 的 handouts 與講義檔），測試不寫死任何講義文字。
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { waitForApp } from './helpers.ts';

interface Deck {
  id: string;
  code: string;
  questionCount: number;
  sections: { id: string; title: string; questionIds: string[] }[];
  file: string;
}
interface Index {
  questionCount: number;
  decks: Deck[];
  review: { excluded: number; check: number; file: string };
}
interface Question {
  id: string;
  options: { letter: string; text: string }[];
  answer: string[];
}

async function index(request: APIRequestContext): Promise<Index> {
  const m = (await (await request.get('/content/content-manifest.json')).json()) as { handouts: Index[] };
  return m.handouts[0]!;
}
async function deckQuestions(request: APIRequestContext, deck: Deck): Promise<Map<string, Question>> {
  const file = (await (await request.get(`/${deck.file}`)).json()) as { questions: Question[] };
  return new Map(file.questions.map((q) => [q.id, q]));
}

async function clearAll(page: Page): Promise<void> {
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

const card = (page: Page) => page.locator('.ll-exam-question');
const radios = (page: Page) => card(page).getByRole('radio');
const submit = (page: Page) => card(page).getByRole('button', { name: '確認答案' });
const next = (page: Page) => page.getByRole('button', { name: '下一題' });
const feedbackTitle = (page: Page) => page.locator('.ll-feedback__title');

/** 作答一題：pickCorrect 決定選正解或第一個錯的選項；回傳選了的字母 */
async function answerOne(page: Page, q: Question, pickCorrect: boolean): Promise<string> {
  const letter = pickCorrect ? q.answer[0]! : q.options.map((o) => o.letter).find((l) => !q.answer.includes(l))!;
  await radios(page)
    .nth(q.options.findIndex((o) => o.letter === letter))
    .check();
  await submit(page).click();
  await expect(feedbackTitle(page)).toHaveText(pickCorrect ? /答對了/ : /再想想/);
  return letter;
}

test.describe('期中考苦練', () => {
  test('首頁與「我的」的入口；苦練首頁的統計、三顆按鈕與講義卡', async ({ page, request }) => {
    const idx = await index(request);
    await clearAll(page);
    await page.getByTestId('home-exam').click();
    await expect(page).toHaveURL(/\/exam\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('期中考苦練');
    await expect(page.getByTestId('exam-hero')).toContainText(`講義 ${idx.questionCount} 題`);
    await expect(page.getByTestId('exam-progress')).toHaveText('還沒開始練');
    await expect(page.getByTestId('exam-start-order')).toHaveAttribute('href', /\/exam\/all\/$/);
    await expect(page.getByTestId('exam-start-random')).toHaveAttribute('href', /\/exam\/all\/\?order=random$/);
    await expect(page.getByTestId('exam-start-wrong')).toBeDisabled();
    await expect(page.getByRole('switch', { name: '打亂選項順序' })).not.toBeChecked();
    for (const d of idx.decks) await expect(page.getByTestId(`exam-deck-${d.id}`)).toContainText(`講義 ${d.code}`);
    await page.getByTestId('exam-deck-d1').locator('summary', { hasText: '各段分開練' }).click();
    await expect(page.getByTestId(`exam-section-${idx.decks[0]!.sections[0]!.id}`)).toBeVisible();
    await page.goto('/me/');
    await waitForApp(page);
    await expect(page.getByTestId('me-exam-row')).toHaveAttribute('href', /\/exam\/$/);
  });

  test('練一段：講義順序的字母、答錯與答對的回饋、講義解析、總結卡、只練錯過的', async ({ page, request }) => {
    const idx = await index(request);
    const d1 = idx.decks.find((d) => d.id === 'd1')!;
    const section = d1.sections[0]!;
    const qs = await deckQuestions(request, d1);
    await clearAll(page);
    await page.goto(`/exam/${section.id}/`);
    await waitForApp(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(section.title);
    await expect(page.getByTestId('exam-resume')).toHaveCount(0);
    const total = section.questionIds.length;
    for (let i = 0; i < total; i++) {
      const q = qs.get(section.questionIds[i]!)!;
      await expect(card(page)).toContainText(`第 ${i + 1} 題，共 ${total} 題`);
      // 講義順序：選項前帶字母，確認前就看得到；沒有「講義的 X」標籤
      await expect(card(page).locator('.ll-exam-letter')).toHaveText(['A.', 'B.', 'C.']);
      await expect(card(page).locator('.ll-exam-letter-tag')).toHaveCount(0);
      await expect(card(page).locator('.ll-exam-scenario')).toContainText('情境');
      const correct = i !== 0;
      await answerOne(page, q, correct);
      await expect(page.getByText(`正確答案：${q.answer.join('、')}`)).toBeVisible();
      await expect(page.getByText('解析出自講義')).toBeVisible();
      await expect(page.locator('.ll-exam-explain .ll-handout-text')).toHaveAttribute('lang', 'zh-TW');
      await next(page).click();
    }
    await expect(page.getByTestId('exam-summary')).toBeVisible();
    await expect(page.getByTestId('exam-score')).toHaveText(`答對 ${total - 1}／${total} 題`);
    await expect(page.getByTestId('exam-retry-wrong')).toContainText('再練錯的（1 題）');
    // 首頁的統計跟著變；只練錯過的只有那一題
    await page.goto('/exam/');
    await waitForApp(page);
    await expect(page.getByTestId('exam-progress')).toContainText(`練過 ${total}／${idx.questionCount} 題`);
    await expect(page.getByTestId('exam-start-wrong')).toContainText('只練錯過的（1 題）');
    await page.getByTestId('exam-start-wrong').click();
    await expect(page).toHaveURL(/\/exam\/wrong\/$/);
    await expect(card(page)).toContainText('第 1 題，共 1 題');
    await answerOne(page, qs.get(section.questionIds[0]!)!, true);
    await next(page).click();
    await expect(page.getByTestId('exam-score')).toHaveText('答對 1／1 題');
    await expect(page.getByTestId('exam-retry-wrong')).toHaveCount(0);
  });

  test('離開再回來沿用上次，可以重新開始；再進首頁主按鈕寫著繼續', async ({ page, request }) => {
    const idx = await index(request);
    const d1 = idx.decks.find((d) => d.id === 'd1')!;
    const qs = await deckQuestions(request, d1);
    await clearAll(page);
    await page.goto('/exam/all/');
    await waitForApp(page);
    for (let i = 0; i < 2; i++) {
      await answerOne(page, qs.get(d1.sections[0]!.questionIds[i]!)!, true);
      await next(page).click();
    }
    await page.goto('/exam/');
    await waitForApp(page);
    await expect(page.getByTestId('exam-start-order')).toContainText('繼續依講義順序練（第 3 題）');
    await page.getByTestId('exam-start-order').click();
    await waitForApp(page);
    await expect(page.getByTestId('exam-resume')).toContainText('接續上次，從第 3 題開始');
    await expect(card(page)).toContainText(`第 3 題，共 ${idx.questionCount} 題`);
    await page.getByTestId('exam-run-restart').click();
    await expect(card(page)).toContainText(`第 1 題，共 ${idx.questionCount} 題`);
    await expect(page.getByTestId('exam-resume')).toHaveCount(0);
  });

  test('打亂選項：確認前沒有字母，確認後每個選項標出講義的字母', async ({ page, request }) => {
    const idx = await index(request);
    const d1 = idx.decks.find((d) => d.id === 'd1')!;
    const qs = await deckQuestions(request, d1);
    await clearAll(page);
    await page.goto('/exam/');
    await waitForApp(page);
    await page.getByRole('switch', { name: '打亂選項順序' }).click();
    await expect(page.getByRole('switch', { name: '打亂選項順序' })).toBeChecked();
    await page.goto(`/exam/${d1.sections[0]!.id}/`);
    await waitForApp(page);
    await expect(card(page).locator('.ll-exam-letter')).toHaveCount(0);
    await radios(page).first().check();
    await submit(page).click();
    await expect(feedbackTitle(page)).toBeVisible();
    const tags = card(page).locator('.ll-exam-letter-tag');
    await expect(tags).toHaveCount(3);
    const texts = await tags.allTextContents();
    expect(texts.map((s) => s.trim()).sort()).toEqual(['講義的 A', '講義的 B', '講義的 C']);
    // 打亂後的順序存起來：重新整理同一題字母的位置不變
    const before = await card(page).locator('.ll-option__text').allTextContents();
    await page.reload();
    await waitForApp(page);
    expect(await card(page).locator('.ll-option__text').allTextContents()).toEqual(before);
    void qs;
  });

  test('B/C 都對那一題是任一正確：選另一個也算對，另一個標「也是合理答案」', async ({ page, request }) => {
    const idx = await index(request);
    const d2 = idx.decks.find((d) => d.id === 'd2')!;
    const qs = await deckQuestions(request, d2);
    const section = d2.sections.find((s) => s.questionIds.some((id) => qs.get(id)!.answer.length > 1))!;
    const multiIndex = section.questionIds.findIndex((id) => qs.get(id)!.answer.length > 1);
    await clearAll(page);
    await page.goto(`/exam/${section.id}/`);
    await waitForApp(page);
    for (let i = 0; i < multiIndex; i++) {
      await answerOne(page, qs.get(section.questionIds[i]!)!, true);
      await next(page).click();
    }
    const q = qs.get(section.questionIds[multiIndex]!)!;
    await expect(card(page).getByText('這題有不只一個合理答案，選出任一個即可。')).toBeVisible();
    const chosen = q.answer[1]!;
    await radios(page)
      .nth(q.options.findIndex((o) => o.letter === chosen))
      .check();
    await submit(page).click();
    await expect(feedbackTitle(page)).toHaveText(/答對了/);
    await expect(card(page).getByText('也是合理答案')).toBeVisible();
    await expect(page.getByText(`正確答案：${q.answer.join('、')}`)).toBeVisible();
  });

  test('老師審核頁：統計、篩選、卡片與相關題的連結；練習頁與審核頁 noindex、苦練首頁沒有', async ({ page, request }) => {
    const idx = await index(request);
    const review = (await (await request.get(`/${idx.review.file}`)).json()) as { questions: { exclusion: { reason: string; related: string[] } }[] };
    const byReason = (r: string) => review.questions.filter((q) => q.exclusion.reason === r).length;
    await clearAll(page);
    await page.goto('/exam/teacher/');
    await waitForApp(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('講義題庫審核');
    await expect(page.getByTestId('exam-teacher-stats')).toHaveText(
      `收錄 ${idx.questionCount} 題；不收 ${idx.review.excluded} 題（答案不同 ${byReason('conflicting_answer')}、解析有誤 ${byReason('explanation_issue')}）；請老師確認 ${byReason('check')} 題。`,
    );
    await expect(page.getByTestId('exam-teacher-card')).toHaveCount(review.questions.length);
    await page.getByRole('radio', { name: /^解析有誤/ }).click();
    await expect(page.getByTestId('exam-teacher-card')).toHaveCount(byReason('explanation_issue'));
    await page.getByRole('radio', { name: /^兩份講義答案不同/ }).click();
    await expect(page.getByTestId('exam-teacher-card')).toHaveCount(byReason('conflicting_answer'));
    const first = page.getByTestId('exam-teacher-card').first();
    await expect(first.locator('.ll-exam-tq__option.is-correct')).toHaveCount(1);
    await expect(first.getByText('我的說明')).toBeVisible();
    await expect(first.getByRole('link', { name: /解答 [ABC]/ }).first()).toHaveAttribute('href', /#hq_[0-9a-z]{8}$/);
    // 路由加的 noindex 帶 data-ll（預覽與本機的殼層另有一個全站的 noindex，正式站沒有）
    const routeMeta = page.locator('meta[name="robots"][data-ll]');
    await expect(routeMeta).toHaveAttribute('content', 'noindex');
    await page.goto('/exam/all/');
    await waitForApp(page);
    await expect(routeMeta).toHaveAttribute('content', 'noindex');
    await page.goto('/exam/');
    await waitForApp(page);
    await expect(routeMeta).toHaveCount(0);
  });

  test('英文站：介面是英文，題目仍是中文並標 lang；不存在的題組是錯誤狀態', async ({ page }) => {
    await clearAll(page);
    await page.goto('/en/exam/');
    await waitForApp(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Midterm drill');
    await expect(page.getByTestId('exam-hero')).toContainText('The question bank is in Chinese only.');
    await page.goto('/en/exam/d1s1/');
    await waitForApp(page);
    await expect(card(page).getByRole('button', { name: 'Check answer' })).toBeVisible();
    await expect(card(page).locator('.ll-exam-scenario .ll-handout-text')).toHaveAttribute('lang', 'zh-TW');
    await page.goto('/exam/nope/');
    await waitForApp(page);
    await expect(page.getByText('沒有這一組題目')).toBeVisible();
  });
});
