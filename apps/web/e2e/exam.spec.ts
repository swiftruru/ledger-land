// 期中考苦練（M4c，02 第 1.1 節）：首頁與「我的」的入口、苦練首頁的統計與按鈕、練一段（答對與答錯的回饋、講義順序的字母、總結卡、只練錯過的）、
// 沿用上次與重新開始、打亂選項時確認後的講義字母、B/C 都對那一題是任一正確、老師審核頁的統計與篩選、noindex、離線保險（開過首頁後講義檔都在快取）、英文站的介面英文而題目中文。
// 第二批（2026-11-05）：隨機抽幾題、熟練與「只練不熟的」、錯題與不熟的清單、背題瀏覽（講義篩選、遮住答案、列印樣式）。
// 背題瀏覽改成清單加逐題閱讀（2026-11-06）：按「讀完了」才算已讀、各範圍的數字一致、接著讀、改回未讀、篩選、重設與復原。
// 模擬考（第二批的第二次交付）：設定與記住上次的選擇、作答中沒有回饋、上一題與改選、交卷確認、成績與逐題清單、算進紀錄、接續與限時自動交卷。
// 苦練的紀錄跟著備份走（2026-11-05）：練過的題匯出備份碼、清掉資料、匯入後回來，再匯入一次不重複計算。
// 題目內容從建置好的快照讀（content-manifest 的 handouts 與講義檔），測試不寫死任何講義文字。
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { waitForApp, waitForSw } from './helpers.ts';

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
  topic: string;
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

/** 這一題在 ledgerland-exam 的 questionState 裡累計作答幾次（資料庫還沒建就是 0；不自己開庫，免得搶在 App 前面建出沒有 store 的空庫） */
async function seenOf(page: Page, id: string): Promise<number> {
  return page.evaluate(async (questionId) => {
    const dbs = await indexedDB.databases();
    if (!dbs.some((d) => d.name === 'ledgerland-exam')) return 0;
    return new Promise<number>((resolve) => {
      const req = indexedDB.open('ledgerland-exam');
      req.onerror = () => resolve(0);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('questionState')) {
          db.close();
          return resolve(0);
        }
        const get = db.transaction('questionState', 'readonly').objectStore('questionState').get(questionId);
        get.onsuccess = () => {
          db.close();
          resolve((get.result as { seen?: number } | undefined)?.seen ?? 0);
        };
        get.onerror = () => {
          db.close();
          resolve(0);
        };
      };
    });
  }, id);
}

/** 作答一題：pickCorrect 決定選正解或第一個錯的選項；回傳選了的字母。確認答案後紀錄是非同步寫進 IndexedDB 的，
 *  等它落地才回來：測試接著整頁導航（page.goto）時才不會和寫入競速 */
async function answerOne(page: Page, q: Question, pickCorrect: boolean): Promise<string> {
  const letter = pickCorrect ? q.answer[0]! : q.options.map((o) => o.letter).find((l) => !q.answer.includes(l))!;
  const before = await seenOf(page, q.id);
  await radios(page)
    .nth(q.options.findIndex((o) => o.letter === letter))
    .check();
  await submit(page).click();
  await expect(feedbackTitle(page)).toHaveText(pickCorrect ? /答對了/ : /再想想/);
  await expect.poll(() => seenOf(page, q.id)).toBe(before + 1);
  return letter;
}

/** ledgerland-exam 的 runs 裡每一輪做到第幾題的總和（資料庫還沒建是 0）：按一次「下一題」剛好加 1（最後一題按下去是題數，也是加 1），
 *  用來確認題目真的前進、而且這一輪已經寫進資料庫 */
async function runProgress(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    if (!dbs.some((d) => d.name === 'ledgerland-exam')) return 0;
    return new Promise<number>((resolve) => {
      const req = indexedDB.open('ledgerland-exam');
      req.onerror = () => resolve(0);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('runs')) {
          db.close();
          return resolve(0);
        }
        const all = db.transaction('runs', 'readonly').objectStore('runs').getAll();
        all.onsuccess = () => {
          db.close();
          resolve((all.result as { index?: number }[]).reduce((n, run) => n + (run.index ?? 0), 0));
        };
        all.onerror = () => {
          db.close();
          resolve(0);
        };
      };
    });
  });
}

/** 按「下一題」，並等題目真的前進、這一輪寫進資料庫才回來。兩件事都曾讓測試偶爾失敗（2026-11-06）：
 *  (1) 確認答案後回饋面板會平滑捲到畫面上緣（FeedbackPanel 的 scrollOnMount），捲動途中用滑鼠點，按鈕在按下與放開之間會移位，點擊可能落空：
 *      main 的 Firefox 工作同一個案例連兩次卡在這裡，trace 裡「下一題」在確認後 160 到 280ms 送出、Playwright 回報點擊完成，畫面卻停在原題。
 *      所以先等按鈕的位置停下來（每 50ms 取樣，連續四次一樣；最多等 3 秒）才點。用計時器取樣，不用 requestAnimationFrame：
 *      Linux 的 WebKit 在靜止的頁面幾乎不跑 rAF。
 *  (2) 這一輪做到第幾題是非同步寫進 IndexedDB 的，測試接著整頁導航（page.goto）會和寫入競速，回到首頁看到的還是上一題。
 *      所以點完等 runs 裡的進度加 1（和 answerOne 等作答紀錄落地是同一個道理） */
async function goNext(page: Page): Promise<void> {
  const before = await runProgress(page);
  await next(page).evaluate(
    (el) =>
      new Promise<void>((resolve) => {
        let last = el.getBoundingClientRect().top;
        let same = 0;
        let ticks = 0;
        const timer = setInterval(() => {
          ticks += 1;
          const top = el.getBoundingClientRect().top;
          if (top === last) same += 1;
          else {
            same = 0;
            last = top;
          }
          if (same >= 4 || ticks >= 60) {
            clearInterval(timer);
            resolve();
          }
        }, 50);
      }),
  );
  await next(page).click();
  await expect.poll(() => runProgress(page), { message: '按「下一題」之後這一輪的進度要加 1' }).toBe(before + 1);
}

/** ledgerland-exam 裡鍵是 mock 的那一輪（模擬考）；patch 有給就把欄位寫回去（測試用來把期限撥近）。資料庫還沒建回 null */
async function mockRun(page: Page, patch?: Record<string, unknown>): Promise<{ questionIds: string[]; deadlineAt?: string; index: number } | null> {
  return page.evaluate(async (fields) => {
    const dbs = await indexedDB.databases();
    if (!dbs.some((d) => d.name === 'ledgerland-exam')) return null;
    return new Promise((resolve) => {
      const req = indexedDB.open('ledgerland-exam');
      req.onerror = () => resolve(null);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('runs')) {
          db.close();
          return resolve(null);
        }
        const tx = db.transaction('runs', fields ? 'readwrite' : 'readonly');
        const store = tx.objectStore('runs');
        const get = store.get('mock');
        get.onsuccess = () => {
          const run = get.result ?? null;
          if (run && fields) store.put({ ...run, ...fields });
          tx.oncomplete = () => {
            db.close();
            resolve(run && fields ? { ...run, ...fields } : run);
          };
        };
        get.onerror = () => {
          db.close();
          resolve(null);
        };
      };
    });
  }, patch ?? null);
}

/** 三份講義收錄的題合成一張表（模擬考跨講義抽題） */
async function allQuestions(request: APIRequestContext, idx: Index): Promise<Map<string, Question>> {
  const maps = await Promise.all(idx.decks.map((d) => deckQuestions(request, d)));
  return new Map(maps.flatMap((m) => [...m]));
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
    await expect(page.getByTestId('exam-start-unsure')).toBeDisabled();
    await expect(page.getByTestId('exam-more-mock')).toHaveAttribute('href', /\/exam\/mock\/$/);
    await expect(page.getByTestId('exam-more-browse')).toHaveAttribute('href', /\/exam\/browse\/$/);
    await expect(page.getByTestId('exam-more-list')).toHaveAttribute('href', /\/exam\/list\/$/);
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
      await goNext(page);
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
    await goNext(page);
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
      await goNext(page);
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

  test('打亂選項：確認前沒有字母，判對判錯照講義的字母不照位置，確認後每個選項標出講義的字母', async ({ page, request }) => {
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
    // 畫面上第一個選項是講義的哪個字母（radio 的 value）：打亂後判對判錯要照那個字母，不是照位置
    const q = qs.get(d1.sections[0]!.questionIds[0]!)!;
    const letter = (await radios(page).first().getAttribute('value'))!;
    expect(q.options.map((o) => o.letter)).toContain(letter);
    await radios(page).first().check();
    await submit(page).click();
    await expect(feedbackTitle(page)).toHaveText(q.answer.includes(letter) ? /答對了/ : /再想想/);
    await expect(card(page).locator('.ll-option.is-chosen .ll-exam-letter-tag')).toHaveText(`講義的 ${letter}`);
    await expect(page.getByText(`正確答案：${q.answer.join('、')}`)).toBeVisible();
    const tags = card(page).locator('.ll-exam-letter-tag');
    await expect(tags).toHaveCount(3);
    const texts = await tags.allTextContents();
    expect(texts.map((s) => s.trim()).sort()).toEqual(['講義的 A', '講義的 B', '講義的 C']);
    // 打亂後的順序存起來：重新整理同一題字母的位置不變
    const before = await card(page).locator('.ll-option__text').allTextContents();
    await page.reload();
    await waitForApp(page);
    expect(await card(page).locator('.ll-option__text').allTextContents()).toEqual(before);
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
      await goNext(page);
      await expect(card(page)).toContainText(`第 ${i + 2} 題，共 ${section.questionIds.length} 題`);
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
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('想請教老師的題目');
    // 「兩份講義答案不同」這一類沒有題目時（2026-11-06 重新審過後是 0 題），統計與篩選都不列它
    const conflicts = byReason('conflicting_answer');
    await expect(page.getByTestId('exam-teacher-stats')).toHaveText(
      conflicts > 0
        ? `目前收錄 ${idx.questionCount} 題；有 ${idx.review.excluded} 題我還沒收錄（兩份講義答案不同 ${conflicts}、解析想請教 ${byReason('explanation_issue')}），想先請教老師；另外 ${byReason('check')} 題已經收錄，也想請老師看看。`
        : `目前收錄 ${idx.questionCount} 題；有 ${idx.review.excluded} 題我還沒收錄，想先請教老師；另外 ${byReason('check')} 題已經收錄，也想請老師看看。`,
    );
    await expect(page.getByTestId('exam-teacher-card')).toHaveCount(review.questions.length);
    await page.getByRole('radio', { name: /^還沒收錄，想請教/ }).click();
    await expect(page.getByTestId('exam-teacher-card')).toHaveCount(byReason('explanation_issue'));
    if (conflicts > 0) {
      await page.getByRole('radio', { name: /^兩份講義答案不同/ }).click();
      await expect(page.getByTestId('exam-teacher-card')).toHaveCount(conflicts);
    } else await expect(page.getByRole('radio', { name: /^兩份講義答案不同/ })).toHaveCount(0);
    const first = page.getByTestId('exam-teacher-card').first();
    await expect(first.locator('.ll-exam-q__option.is-correct')).toHaveCount(1);
    await expect(first.getByText('我的想法')).toBeVisible();
    // 相關題的連結只在有題目互相指向時才有（「兩份講義答案不同」那一類）；現在的資料沒有，這一段跟著資料走
    if (review.questions.some((q) => q.exclusion.related.length > 0))
      await expect(
        page
          .getByTestId('exam-teacher-card')
          .getByRole('link', { name: /解答 [ABC]/ })
          .first(),
      ).toHaveAttribute('href', /#hq_[0-9a-z]{8}$/);
    else await expect(page.getByTestId('exam-teacher-card').getByRole('link', { name: /解答 [ABC]/ })).toHaveCount(0);
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

  test('隨機抽幾題：首頁選題數會記住，網址帶 n；換題數就開新的一輪，全部隨機是整份題庫', async ({ page, request }) => {
    const idx = await index(request);
    await clearAll(page);
    await page.goto('/exam/');
    await waitForApp(page);
    await expect(page.getByTestId('exam-start-random')).toHaveText('隨機抽 20 題');
    await page.getByRole('radiogroup', { name: '隨機抽幾題' }).getByRole('radio', { name: '30' }).click();
    await expect(page.getByTestId('exam-start-random')).toHaveText('隨機抽 30 題');
    await expect(page.getByTestId('exam-start-random')).toHaveAttribute('href', /\/exam\/all\/\?order=random&n=30$/);
    await page.getByTestId('exam-start-random').click();
    await waitForApp(page);
    await expect(card(page)).toContainText('第 1 題，共 30 題');
    // 同一個題組換成 50 題：不沿用 30 題的那一輪
    await page.goto('/exam/all/?order=random&n=50');
    await waitForApp(page);
    await expect(card(page)).toContainText('第 1 題，共 50 題');
    await expect(page.getByTestId('exam-resume')).toHaveCount(0);
    await page.goto('/exam/all/?order=random&n=all');
    await waitForApp(page);
    await expect(card(page)).toContainText(`第 1 題，共 ${idx.questionCount} 題`);
    // 不合法的 n 用預設的 20；首頁記得上次選的 30
    await page.goto('/exam/all/?order=random&n=7');
    await waitForApp(page);
    await expect(card(page)).toContainText('第 1 題，共 20 題');
    await page.goto('/exam/');
    await waitForApp(page);
    await expect(page.getByTestId('exam-start-random')).toHaveText('隨機抽 30 題');
    await page.getByRole('radiogroup', { name: '隨機抽幾題' }).getByRole('radio', { name: '全部' }).click();
    await expect(page.getByTestId('exam-start-random')).toHaveText('全部隨機練');
  });

  test('熟練：答對一次還不熟，進「只練不熟的」；連對兩次算熟練', async ({ page, request }) => {
    const idx = await index(request);
    const d1 = idx.decks.find((d) => d.id === 'd1')!;
    const qs = await deckQuestions(request, d1);
    const first = qs.get(d1.sections[0]!.questionIds[0]!)!;
    await clearAll(page);
    await page.goto(`/exam/${d1.sections[0]!.id}/`);
    await waitForApp(page);
    await answerOne(page, first, true);
    await page.goto('/exam/');
    await waitForApp(page);
    await expect(page.getByTestId('exam-progress')).toContainText('熟練 0 題');
    await expect(page.getByTestId('exam-start-unsure')).toContainText('只練不熟的（1 題）');
    await expect(page.getByTestId('exam-start-wrong')).toBeDisabled();
    await page.getByTestId('exam-start-unsure').click();
    await waitForApp(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('還不熟的題');
    await expect(card(page)).toContainText('第 1 題，共 1 題');
    await answerOne(page, first, true);
    await page.goto('/exam/');
    await waitForApp(page);
    await expect(page.getByTestId('exam-progress')).toContainText('熟練 1 題');
    await expect(page.getByTestId('exam-start-unsure')).toBeDisabled();
    await page.goto('/exam/unsure/');
    await waitForApp(page);
    await expect(page.getByText('還沒有不熟的題')).toBeVisible();
  });

  test('錯題與不熟的清單：空狀態、兩組的題數、展開看我選的與解析、拿去練；noindex', async ({ page, request }) => {
    const idx = await index(request);
    const d1 = idx.decks.find((d) => d.id === 'd1')!;
    const qs = await deckQuestions(request, d1);
    const ids = d1.sections[0]!.questionIds;
    await clearAll(page);
    await page.goto('/exam/list/');
    await waitForApp(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('錯過與還不熟的題');
    await expect(page.getByText('還沒有錯過的題')).toBeVisible();
    await expect(page.getByTestId('exam-list-practise')).toHaveCount(0);
    await expect(page.locator('meta[name="robots"][data-ll]')).toHaveAttribute('content', 'noindex');
    // 第 1 題答錯、第 2 題答對：答錯的 1 題，還不熟的 2 題
    await page.goto(`/exam/${d1.sections[0]!.id}/`);
    await waitForApp(page);
    const wrongLetter = await answerOne(page, qs.get(ids[0]!)!, false);
    await goNext(page);
    await answerOne(page, qs.get(ids[1]!)!, true);
    await page.goto('/exam/list/');
    await waitForApp(page);
    await expect(page.getByRole('radio', { name: '答錯的 1' })).toBeChecked();
    await expect(page.getByTestId('exam-list-practise')).toHaveText('練這些（1 題）');
    await expect(page.getByTestId('exam-list-practise')).toHaveAttribute('href', /\/exam\/wrong\/$/);
    const deck = page.getByTestId('exam-list-deck-d1');
    await expect(deck.locator('summary')).toHaveCount(1);
    await expect(deck.getByText('答錯 1 次')).toBeVisible();
    await deck.locator('summary').first().click();
    const wrongOption = deck.locator('.ll-exam-q__option.is-wrong');
    await expect(wrongOption).toHaveCount(1);
    await expect(wrongOption).toContainText(`${wrongLetter}.`);
    await expect(wrongOption).toContainText('我選的');
    await expect(deck.locator('.ll-exam-q__option.is-correct')).toHaveCount(qs.get(ids[0]!)!.answer.length);
    await expect(deck.getByText('解析出自講義')).toBeVisible();
    await page.getByRole('radio', { name: '還不熟的 2' }).click();
    await expect(page).toHaveURL(/\/exam\/list\/\?filter=unsure$/);
    await expect(deck.locator('summary')).toHaveCount(2);
    await expect(page.getByTestId('exam-list-practise')).toHaveAttribute('href', /\/exam\/unsure\/$/);
  });

  test('背題瀏覽：清單只列標題、點進去一次一題、遮住答案與看答案、偏好記住、列印印出這個範圍的完整題目；noindex', async ({ page, request }) => {
    const idx = await index(request);
    const d1 = idx.decks.find((d) => d.id === 'd1')!;
    const d2 = idx.decks.find((d) => d.id === 'd2')!;
    await clearAll(page);
    await page.goto('/exam/browse/');
    await waitForApp(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('背題瀏覽');
    await expect(page.locator('meta[name="robots"][data-ll]')).toHaveAttribute('content', 'noindex');
    // 清單：不再把題目全部攤開；只打開第一段，其餘收著
    const rows = page.getByTestId('exam-browse-row');
    await expect(page.getByTestId('exam-browse-item')).toHaveCount(0);
    await expect(page.getByTestId('exam-browse-start')).toHaveAttribute('data-kind', 'start');
    await expect(page.getByTestId('exam-browse-count')).toHaveText(`已讀 0／${idx.questionCount} 題`);
    await expect(rows).toHaveCount(d1.sections[0]!.questionIds.length);
    await page.getByRole('radio', { name: `講義 ${d2.code}` }).click();
    await expect(page).toHaveURL(/\/exam\/browse\/\?deck=d2$/);
    await expect(page.getByTestId('exam-browse-count')).toHaveText(`已讀 0／${d2.questionCount} 題`);
    await expect(rows).toHaveCount(d2.sections[0]!.questionIds.length);
    await page.getByTestId(`exam-browse-section-${d2.sections[1]!.id}`).locator('summary').click();
    await expect(rows).toHaveCount(d2.sections[0]!.questionIds.length + d2.sections[1]!.questionIds.length);
    // 點一題進閱讀頁：一次一題
    const [first, second] = d2.sections[0]!.questionIds as [string, string];
    await rows.first().click();
    const reader = page.getByTestId('exam-reader');
    await expect(reader).toHaveAttribute('data-question', first);
    await expect(page).toHaveURL(new RegExp(`\\?deck=d2&q=${first}$`));
    await expect(page.getByTestId('exam-reader-pos')).toHaveText(`第 1／${d2.questionCount} 題`);
    await expect(reader.locator('.ll-exam-q__answer')).toBeVisible();
    await expect(reader.locator('.ll-exam-q__option.is-correct').first()).toBeVisible();
    await expect(reader.locator('.ll-exam-q__options')).toHaveAttribute('lang', 'zh-TW');
    await expect(page.getByTestId('exam-reader-prev')).toBeDisabled();
    // 遮住：解答行與解析不見，選項沒有打勾；「看答案」只掀開這一題
    await page.getByRole('switch', { name: '遮住答案與解析' }).click();
    await expect(reader.locator('.ll-exam-q__answer')).toBeHidden();
    await expect(reader.locator('.ll-exam-q__explain')).toBeHidden();
    await expect(reader.locator('.ll-exam-q__mark')).toBeHidden();
    await reader.getByRole('button', { name: '看答案' }).click();
    await expect(reader.locator('.ll-exam-q__answer')).toBeVisible();
    await reader.getByRole('button', { name: '遮回去' }).click();
    await expect(reader.locator('.ll-exam-q__answer')).toBeHidden();
    await reader.getByRole('button', { name: '看答案' }).click();
    // 換一題：又是遮住的
    await page.getByTestId('exam-reader-next').click();
    await expect(reader).toHaveAttribute('data-question', second);
    await expect(reader.locator('.ll-exam-q__answer')).toBeHidden();
    await page.reload();
    await waitForApp(page);
    await expect(reader).toHaveAttribute('data-question', second);
    await expect(page.getByRole('switch', { name: '遮住答案與解析' })).toBeChecked();
    await expect(reader.locator('.ll-exam-q__answer')).toBeHidden();
    // 回清單（換題不留瀏覽紀錄，按一次返回就回到清單）
    await page.goBack();
    await expect(page.getByTestId('exam-browse-start')).toBeVisible();
    await expect(page).toHaveURL(/\/exam\/browse\/\?deck=d2$/);
    // 列印：按下去才畫出這個範圍的完整題目；列印時不印清單與工具
    await page.evaluate(() => {
      window.print = () => undefined;
    });
    await page.getByTestId('exam-browse-more').locator('summary').click();
    await page.getByTestId('exam-browse-print').click();
    const items = page.getByTestId('exam-browse-item');
    await expect(items).toHaveCount(d2.questionCount);
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByTestId('exam-browse-tools').first()).toBeHidden();
    await expect(page.getByTestId('exam-browse-start')).toBeHidden();
    await expect(page.locator('.ll-exam-print-only')).toBeVisible();
    await expect(items.first().locator('.ll-exam-q__question')).toBeVisible();
    await expect(items.first().locator('.ll-exam-q__answer')).toBeHidden();
    await page.emulateMedia({ media: 'screen' });
    await expect(items.first()).toBeHidden();
  });

  test('背題瀏覽：按「讀完了」才算已讀、全部與各份講義的數字一致、下次回來接著讀、單題改回未讀、篩選未讀、重設與復原', async ({ page, request }) => {
    const idx = await index(request);
    const d1 = idx.decks.find((d) => d.id === 'd1')!;
    const d2 = idx.decks.find((d) => d.id === 'd2')!;
    const s1 = d1.sections[0]!;
    expect(s1.questionIds.length).toBeGreaterThanOrEqual(3);
    const [id1, id2, id3] = s1.questionIds as [string, string, string];
    const topics = await deckQuestions(request, d1);
    const all = idx.questionCount;
    const start = page.getByTestId('exam-browse-start');
    const count = page.getByTestId('exam-browse-count');
    const reader = page.getByTestId('exam-reader');
    const row = (id: string) => page.locator(`#ll-exam-browse-row-${id}`);
    await clearAll(page);
    await page.goto('/exam/browse/');
    await waitForApp(page);
    await page.getByTestId('exam-browse-go').click();
    await expect(reader).toHaveAttribute('data-question', id1);
    // 只翻頁：不算已讀，但位置會記
    await page.getByTestId('exam-reader-next').click();
    await expect(reader).toHaveAttribute('data-question', id2);
    await page.getByTestId('exam-reader-prev').click();
    await expect(reader).toHaveAttribute('data-question', id1);
    await page.goBack();
    await expect(count).toHaveText(`已讀 0／${all} 題`);
    await expect(start).toHaveAttribute('data-kind', 'resume');
    await expect(page.getByTestId('exam-browse-resume-where')).toContainText(topics.get(id1)!.topic);
    // 讀完兩題
    await page.getByTestId('exam-browse-go').click();
    await expect(reader).toHaveAttribute('data-question', id1);
    await expect(page.getByTestId('exam-reader-done')).toHaveText('讀完了，下一題');
    await page.getByTestId('exam-reader-done').click();
    await expect(reader).toHaveAttribute('data-question', id2);
    await page.getByTestId('exam-reader-done').click();
    await expect(reader).toHaveAttribute('data-question', id3);
    await expect(page.getByTestId('exam-reader-pos')).toHaveText(`第 3／${all} 題`);
    await page.goBack();
    // 清單：開始卡、這一份、這一段的數字一致；回到剛才那一題的列
    await expect(count).toHaveText(`已讀 2／${all} 題`);
    await expect(page.getByTestId('exam-browse-deck-count-d1')).toHaveText(`已讀 2／${d1.questionCount} 題`);
    await expect(page.getByTestId('exam-browse-deck-count-d2')).toHaveText(`已讀 0／${d2.questionCount} 題`);
    await expect(page.getByTestId(`exam-browse-section-${s1.id}`).locator('summary')).toContainText(`已讀 2／${s1.questionIds.length}`);
    await expect(row(id1)).toContainText('（已讀）');
    await expect(row(id2)).toContainText('（已讀）');
    await expect(row(id3)).toContainText('（未讀）');
    await expect(row(id3)).toContainText('上次讀到');
    expect(await page.evaluate(() => document.activeElement?.closest('[id^="ll-exam-browse-row-"]')?.id)).toBe(`ll-exam-browse-row-${id3}`);
    // 同一題在「全部」與講義裡是同一份狀態
    await page.getByRole('radio', { name: `講義 ${d1.code}` }).click();
    await expect(count).toHaveText(`已讀 2／${d1.questionCount} 題`);
    await expect(row(id1)).toContainText('（已讀）');
    await page.getByRole('radio', { name: `講義 ${d2.code}` }).click();
    await expect(count).toHaveText(`已讀 0／${d2.questionCount} 題`);
    await expect(start).toHaveAttribute('data-kind', 'start');
    await page.getByRole('radio', { name: `講義 ${d1.code}` }).click();
    await expect(page).toHaveURL(/\/exam\/browse\/\?deck=d1$/);
    // 苦練首頁的入口寫著讀了幾題、上次讀到哪一份
    await page.goto('/exam/');
    await waitForApp(page);
    await expect(page.getByTestId('exam-more-browse')).toContainText(`已讀 2／${all} 題，上次讀到講義 ${d1.code}。`);
    // 下次回來（網址沒有範圍）：記得上次的範圍，開始卡接著讀第三題
    await page.getByTestId('exam-more-browse').click();
    await waitForApp(page);
    await expect(page.getByRole('radio', { name: `講義 ${d1.code}` })).toBeChecked();
    await expect(start).toHaveAttribute('data-kind', 'resume');
    await expect(page.getByTestId('exam-browse-resume-where')).toContainText(topics.get(id3)!.topic);
    await page.getByTestId('exam-browse-go').click();
    await expect(reader).toHaveAttribute('data-question', id3);
    // 單題改回未讀
    await page.getByTestId('exam-reader-prev').click();
    await expect(reader).toHaveAttribute('data-question', id2);
    await expect(page.getByTestId('exam-reader-done')).toHaveText('下一題');
    await page.getByTestId('exam-reader-unread').click();
    await expect(page.getByTestId('exam-reader-unread')).toHaveCount(0);
    await expect(page.getByTestId('exam-reader-done')).toHaveText('讀完了，下一題');
    await page.goBack();
    await expect(count).toHaveText(`已讀 1／${d1.questionCount} 題`);
    // 篩選未讀：已讀的題不列；閱讀頁的上一題與下一題跳過已讀
    await page.getByRole('radiogroup', { name: '要列出哪些題' }).getByRole('radio', { name: '未讀' }).click();
    await expect(page).toHaveURL(/\?deck=d1&show=unread$/);
    await expect(row(id1)).toHaveCount(0);
    await row(id2).click();
    await expect(reader).toHaveAttribute('data-question', id2);
    await expect(page.getByTestId('exam-reader-prev')).toBeDisabled();
    await page.goBack();
    await page.getByRole('radiogroup', { name: '要列出哪些題' }).getByRole('radio', { name: '全部' }).click();
    // 重設這一份：先確認，做完可以復原
    await page.getByTestId('exam-browse-more').locator('summary').click();
    await page.getByTestId('exam-browse-reset').click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toContainText(`把講義 ${d1.code} 改回未讀`);
    await expect(sheet).toContainText('會把 1 題改回未讀');
    await sheet.getByRole('button', { name: '改回未讀' }).click();
    await expect(count).toHaveText(`已讀 0／${d1.questionCount} 題`);
    await expect(start).toHaveAttribute('data-kind', 'start');
    await page.getByTestId('exam-browse-toasts').getByRole('button', { name: '復原' }).click();
    await expect(count).toHaveText(`已讀 1／${d1.questionCount} 題`);
    await expect(start).toHaveAttribute('data-kind', 'resume');
    // 範圍的最後一題：按「讀完了」後是結束卡
    const last = d1.sections.at(-1)!.questionIds.at(-1)!;
    await page.goto(`/exam/browse/?deck=d1&q=${last}`);
    await waitForApp(page);
    await expect(page.getByTestId('exam-reader-next')).toBeDisabled();
    await expect(page.getByTestId('exam-reader-done')).toHaveText('讀完了');
    await page.getByTestId('exam-reader-done').click();
    const end = page.getByTestId('exam-reader-end');
    await expect(end.getByRole('heading')).toHaveText('讀到最後一題了');
    await expect(end).toContainText(`已讀 2／${d1.questionCount} 題`);
    await expect(page.getByTestId('exam-reader-end-list')).toHaveAttribute('href', /\/exam\/browse\/\?deck=d1$/);
  });

  test('模擬考：設定會記住、作答中沒有回饋、上一題與改選、交卷確認、成績與逐題清單、算進紀錄；noindex', async ({ page, request }) => {
    const idx = await index(request);
    const d2 = idx.decks.find((d) => d.id === 'd2')!;
    const qs = await allQuestions(request, idx);
    await clearAll(page);
    await page.goto('/exam/');
    await waitForApp(page);
    await page.getByTestId('exam-more-mock').click();
    await waitForApp(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('模擬考');
    await expect(page.locator('meta[name="robots"][data-ll]')).toHaveAttribute('content', 'noindex');
    // 預設 30 題、每題 60 秒
    await expect(page.getByTestId('exam-mock-plan')).toHaveText('共 30 題，限時 30 分 0 秒，時間到自動交卷。');
    await page
      .getByRole('radiogroup', { name: '範圍' })
      .getByRole('radio', { name: `講義 ${d2.code}` })
      .click();
    await page.getByRole('radiogroup', { name: '題數' }).getByRole('radio', { name: '20' }).click();
    await page.getByRole('radiogroup', { name: '每題時間' }).getByRole('radio', { name: '不限時' }).click();
    await expect(page.getByTestId('exam-mock-plan')).toHaveText('共 20 題，不限時。');
    await page.getByTestId('exam-mock-start').click();
    await expect(card(page)).toContainText('第 1 題，共 20 題');
    await expect(page.getByTestId('exam-mock-status')).toHaveText('已作答 0／20 題');
    await expect(page.getByTestId('exam-mock-timer')).toHaveCount(0);
    const run = (await mockRun(page))!;
    expect(run.questionIds).toHaveLength(20);
    for (const id of run.questionIds) expect(d2.sections.flatMap((s) => s.questionIds)).toContain(id);
    const q1 = qs.get(run.questionIds[0]!)!;
    const q2 = qs.get(run.questionIds[1]!)!;
    const indexOf = (q: Question, letter: string) => q.options.findIndex((o) => o.letter === letter);
    const wrongOf = (q: Question) => q.options.map((o) => o.letter).find((l) => !q.answer.includes(l))!;
    // 第 1 題先選錯的：沒有回饋，主按鈕是「下一題」
    await radios(page)
      .nth(indexOf(q1, wrongOf(q1)))
      .check();
    await expect(page.getByTestId('exam-mock-status')).toHaveText('已作答 1／20 題');
    await expect(feedbackTitle(page)).toHaveCount(0);
    await card(page).getByRole('button', { name: '下一題' }).click();
    await expect(card(page)).toContainText('第 2 題，共 20 題');
    await radios(page)
      .nth(indexOf(q2, wrongOf(q2)))
      .check();
    // 沒選也能跳過；上一題回來選擇還在，可以改選
    await card(page).getByRole('button', { name: '下一題' }).click();
    await card(page).getByRole('button', { name: '下一題' }).click();
    await expect(card(page)).toContainText('第 4 題，共 20 題');
    for (let i = 0; i < 3; i++) await page.getByTestId('exam-mock-prev').click();
    await expect(card(page)).toContainText('第 1 題，共 20 題');
    await expect(page.getByTestId('exam-mock-prev')).toBeDisabled();
    await expect(radios(page).nth(indexOf(q1, wrongOf(q1)))).toBeChecked();
    await radios(page).nth(indexOf(q1, q1.answer[0]!)).check();
    await expect(page.getByTestId('exam-mock-status')).toHaveText('已作答 2／20 題');
    // 交卷：先確認，取消不交
    await page.getByTestId('exam-mock-submit').click();
    const sheet = page.getByTestId('exam-mock-confirm');
    await expect(sheet).toContainText('還有 18 題沒作答');
    await sheet.getByRole('button', { name: '取消' }).click();
    await expect(page.getByTestId('exam-mock-result')).toHaveCount(0);
    await page.getByTestId('exam-mock-submit').click();
    await sheet.getByRole('button', { name: '交卷' }).click();
    await expect(page.getByTestId('exam-mock-score')).toHaveText('答對 1／20 題（5%）');
    await expect(page.getByTestId('exam-mock-detail')).toContainText('18 題沒作答');
    await expect(page.getByTestId('exam-mock-expired')).toHaveCount(0);
    const items = page.getByTestId('exam-mock-items').locator('summary');
    await expect(items).toHaveCount(20);
    await expect(page.getByTestId('exam-mock-items').getByText('答對', { exact: true })).toHaveCount(1);
    await expect(page.getByTestId('exam-mock-items').getByText('沒作答', { exact: true })).toHaveCount(18);
    await page.getByRole('radio', { name: '答錯與沒作答 19' }).click();
    await expect(items).toHaveCount(19);
    await items.first().click();
    const firstWrong = page.getByTestId('exam-mock-items').locator('.ll-exam-q').first();
    await expect(firstWrong.locator('.ll-exam-q__option.is-wrong')).toContainText('我選的');
    await expect(firstWrong.getByText('解析出自講義')).toBeVisible();
    await expect(page.getByTestId('exam-mock-wrong')).toHaveText('再練錯的（1 題）');
    // 重新整理成績還在；作答過的兩題進了紀錄，沒選的不算
    await expect.poll(() => seenOf(page, q2.id)).toBe(1);
    await page.reload();
    await waitForApp(page);
    await expect(page.getByTestId('exam-mock-score')).toHaveText('答對 1／20 題（5%）');
    await page.goto('/exam/');
    await waitForApp(page);
    await expect(page.getByTestId('exam-progress')).toContainText(`練過 2／${idx.questionCount} 題`);
    await expect(page.getByTestId('exam-start-wrong')).toContainText('只練錯過的（1 題）');
    // 換設定：回到設定畫面，記得上次選的
    await page.goto('/exam/mock/');
    await waitForApp(page);
    await page.getByTestId('exam-mock-resetup').click();
    await expect(page.getByTestId('exam-mock-setup')).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: '題數' }).getByRole('radio', { name: '20' })).toBeChecked();
    await expect(page.getByRole('radiogroup', { name: '每題時間' }).getByRole('radio', { name: '不限時' })).toBeChecked();
    await expect(page.getByRole('radiogroup', { name: '範圍' }).getByRole('radio', { name: `講義 ${d2.code}` })).toBeChecked();
  });

  test('模擬考：限時的場次有倒數，離開再回來接續，時間到自動交卷；再考一次沿用設定，放棄重來回到設定', async ({ page, request }) => {
    const idx = await index(request);
    const qs = await allQuestions(request, idx);
    await clearAll(page);
    await page.goto('/exam/mock/');
    await waitForApp(page);
    await page.getByTestId('exam-mock-start').click();
    await expect(card(page)).toContainText('第 1 題，共 30 題');
    await expect(page.getByTestId('exam-mock-timer')).toHaveText(/^剩 (29|30) 分 \d+ 秒$/);
    const run = (await mockRun(page))!;
    const q1 = qs.get(run.questionIds[0]!)!;
    await radios(page)
      .nth(q1.options.findIndex((o) => o.letter === q1.answer[0]))
      .check();
    await expect(page.getByTestId('exam-mock-status')).toHaveText('已作答 1／30 題');
    await card(page).getByRole('button', { name: '下一題' }).click();
    await expect(card(page)).toContainText('第 2 題，共 30 題');
    // 這一輪是非同步寫進 IndexedDB 的：等「走到第 2 題」落地才整頁導航，不和寫入競速
    await expect.poll(async () => (await mockRun(page))?.index).toBe(1);
    // 離開再回來：接續同一場，停在第 2 題
    await page.goto('/exam/');
    await waitForApp(page);
    await page.goto('/exam/mock/');
    await waitForApp(page);
    await expect(page.getByTestId('exam-mock-resume')).toContainText('接續上次的模擬考');
    await expect(card(page)).toContainText('第 2 題，共 30 題');
    await expect(page.getByTestId('exam-mock-status')).toHaveText('已作答 1／30 題');
    // 把期限撥到 3 秒後：倒數到 0 自動交卷，成績照已作答的算
    await mockRun(page, { deadlineAt: new Date(Date.now() + 3000).toISOString() });
    await page.reload();
    await waitForApp(page);
    await expect(page.getByTestId('exam-mock-expired')).toHaveText('時間到，已自動交卷。', { timeout: 15_000 });
    await expect(page.getByTestId('exam-mock-score')).toHaveText('答對 1／30 題（3%）');
    await expect(page.getByTestId('exam-mock-detail')).toContainText('29 題沒作答');
    // 期限已過才回來：直接看到成績，不再是作答畫面
    await page.reload();
    await waitForApp(page);
    await expect(page.getByTestId('exam-mock-score')).toHaveText('答對 1／30 題（3%）');
    // 再考一次沿用 30 題、每題 60 秒
    await page.getByTestId('exam-mock-again').click();
    await expect(card(page)).toContainText('第 1 題，共 30 題');
    await expect(page.getByTestId('exam-mock-timer')).toBeVisible();
    await expect(page.getByTestId('exam-mock-status')).toHaveText('已作答 0／30 題');
    await page.reload();
    await waitForApp(page);
    await page.getByTestId('exam-mock-abandon').click();
    await expect(page.getByTestId('exam-mock-setup')).toBeVisible();
    await expect.poll(() => mockRun(page)).toBeNull();
  });

  test('苦練的紀錄跟著備份走：練兩題、匯出備份碼、清掉資料、匯入後進度與錯過的題都回來；再匯入一次結果一樣', async ({
    page,
    request,
    context,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', '剪貼簿只在 Chromium 穩定（和 backup.spec.ts 一樣）');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const idx = await index(request);
    const d1 = idx.decks.find((d) => d.id === 'd1')!;
    const qs = await deckQuestions(request, d1);
    const ids = d1.sections[0]!.questionIds;
    await clearAll(page);
    await page.goto(`/exam/${d1.sections[0]!.id}/`);
    await waitForApp(page);
    await answerOne(page, qs.get(ids[0]!)!, false);
    await goNext(page);
    await answerOne(page, qs.get(ids[1]!)!, true);
    // 匯出：備份碼帶著苦練的紀錄（兩題而已，放得下）
    await page.goto('/me/backup/');
    await waitForApp(page);
    await page.getByRole('button', { name: '複製備份碼' }).click();
    await expect(page.getByTestId('export-message')).toContainText('已複製');
    await expect(page.getByTestId('export-message')).not.toContainText('放不下');
    const code = await page.getByTestId('backup-code').inputValue();
    // 清掉這台裝置的資料（進度與苦練兩個資料庫），模擬換裝置
    await clearAll(page);
    await page.goto('/exam/');
    await waitForApp(page);
    await expect(page.getByTestId('exam-progress')).toHaveText('還沒開始練');
    const importOnce = async () => {
      await page.goto('/me/backup/?import=code');
      await waitForApp(page);
      await page.getByTestId('paste-code').fill(code);
      await page.getByRole('button', { name: '檢查備份碼' }).click();
      await expect(page.getByTestId('import-preview-exam')).toHaveText(/另外帶著期中考苦練\s2\s題的練習紀錄。/);
      await page.getByTestId('import-confirm').click();
      await expect(page.getByTestId('import-message')).toContainText('已合併');
    };
    const expectRestored = async () => {
      await page.goto('/exam/');
      await waitForApp(page);
      await expect(page.getByTestId('exam-progress')).toContainText(`練過 2／${idx.questionCount} 題`);
      await expect(page.getByTestId('exam-start-wrong')).toContainText('只練錯過的（1 題）');
      await expect(page.getByTestId('exam-start-unsure')).toContainText('只練不熟的（2 題）');
    };
    await importOnce();
    await expectRestored();
    // 錯題清單也認得：答錯的那一題標著上次選的選項
    await page.goto('/exam/list/');
    await waitForApp(page);
    await page.getByTestId('exam-list-deck-d1').locator('summary').first().click();
    await expect(page.getByTestId('exam-list-deck-d1').locator('.ll-exam-q__option.is-wrong')).toContainText('我選的');
    // 同一份備份再匯入一次：次數不會加倍
    await importOnce();
    await expectRestored();
    expect(await seenOf(page, ids[0]!)).toBe(1);
  });

  test('離線保險：開過苦練首頁後，Service Worker 把三份講義檔抓進快取，沒練過的講義離線也能開', async ({ page, request, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'Service Worker 的離線測試只在 Chromium 穩定；WebKit 與實機依手動清單');
    const idx = await index(request);
    await clearAll(page);
    await waitForSw(page);
    await page.goto('/exam/');
    await waitForApp(page);
    // 首頁畫好後在閒置時送 PREFETCH_HANDOUT，SW 用 CacheFirst 抓進 ll-handout（檔名帶 hash，key 就是講義檔的網址）
    await expect
      .poll(() => page.evaluate(async () => (await (await caches.open('ll-handout')).keys()).map((r) => new URL(r.url).pathname)), { timeout: 30_000 })
      .toEqual(expect.arrayContaining(idx.decks.map((d) => `/${d.file}`)));
    await context.setOffline(true);
    const last = [...idx.decks].sort((a, b) => a.id.localeCompare(b.id)).at(-1)!;
    await page.goto(`/exam/${last.id}/`);
    await waitForApp(page);
    await expect(card(page)).toContainText(`第 1 題，共 ${last.questionCount} 題`);
    await context.setOffline(false);
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
