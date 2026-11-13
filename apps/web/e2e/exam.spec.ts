// 期中考苦練（M4c，02 第 1.1 節）：首頁與「我的」的入口、苦練首頁的統計與按鈕、練一段（答對與答錯的回饋、講義順序的字母、總結卡、只練錯過的）、
// 沿用上次與重新開始、打亂選項時確認後的講義字母、B/C 都對那一題是任一正確、老師審核頁的統計與篩選、noindex、離線保險（開過首頁後講義檔都在快取）、英文站的介面英文而題目中文。
// 第二批（2026-11-05）：隨機抽幾題、熟練與「只練不熟的」、錯題與不熟的清單、背題瀏覽（講義篩選、遮住答案、列印樣式）。
// 背題瀏覽改成清單加逐題閱讀（2026-11-06）：按「讀完了」才算已讀、各範圍的數字一致、接著讀、改回未讀、篩選、重設與復原。
// 苦練徽章（2026-11-06）：讀完一份時頒發與提示、首頁與徽章頁的顯示、模擬考交卷時頒發。
// 苦練首頁改成三步（2026-11-06）：先讀題、再自己練、最後模擬考；建議的步驟跟著進度換。
// 背題瀏覽的關鍵字搜尋（2026-11-06）：只列比中的題、閱讀頁在結果裡翻頁、換範圍、沒有結果與清除。
// 模擬考（第二批的第二次交付）：設定與記住上次的選擇、作答中沒有回饋、上一題與改選、交卷確認、成績與逐題清單、算進紀錄、接續與限時自動交卷。
// 苦練的紀錄跟著備份走（2026-11-05）：練過的題匯出備份碼、清掉資料、匯入後回來，再匯入一次不重複計算。
// 錯題再答錯（2026-11-13）：錯過的與不熟的題組每次進來都依目前的紀錄重新出題，不沿用上一輪。
// 錯題複習（2026-11-13）：三個階段、訂正與再練下一輪、反覆答錯的題當天連對兩次後明天再練、隔天答對才熟練；確認答案後的階段說明。
// 答錯的題排回同一輪（2026-11-13）：隔 3 題再出一次並標「再試一次」、同一題一輪最多再出兩次、總結卡以題計分並寫加練與訂正。
// 練習紀錄（2026-11-13）：空狀態、今天與近 7 天的數字、長條圖與每天的數字表格、把作答時間往前撥後的兩天與連續天數、近 30 天、入口。
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

/** 把 ledgerland-exam 的 questionState 裡某一題的欄位改掉（測試用來把作答時間往前撥，模擬「隔天」） */
async function patchState(page: Page, id: string, patch: Record<string, unknown>): Promise<void> {
  await page.evaluate(
    ({ qid, fields }) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('ledgerland-exam');
        req.onerror = () => reject(new Error('open'));
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('questionState', 'readwrite');
          const store = tx.objectStore('questionState');
          const get = store.get(qid);
          get.onsuccess = () => {
            if (get.result) store.put({ ...get.result, ...fields });
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(new Error('tx'));
          };
        };
      }),
    { qid: id, fields: patch },
  );
}

/** 三份講義收錄的題合成一張表（模擬考跨講義抽題） */
/** 背題瀏覽的已讀紀錄（ledgerland-exam-read 的 marks）現在有幾筆；資料庫還沒建就是 0（不自己開庫，理由同 seenOf）。
 *  已讀是先改畫面再寫資料庫，測試要換頁或重新載入之前先等它寫進去 */
/** 把某一題在 ledgerland-exam 的作答明細（attempts）的時間改掉（測試用來模擬前幾天練的題，不改時鐘） */
async function shiftAttempts(page: Page, id: string, at: string): Promise<void> {
  await page.evaluate(
    ({ qid, time }) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('ledgerland-exam');
        req.onerror = () => reject(new Error('open'));
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('attempts', 'readwrite');
          const store = tx.objectStore('attempts');
          const all = store.getAll();
          all.onsuccess = () => {
            for (const a of all.result as { questionId: string }[]) if (a.questionId === qid) store.put({ ...a, at: time });
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(new Error('tx'));
          };
        };
      }),
    { qid: id, time: at },
  );
}

async function readMarkCount(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    if (!dbs.some((d) => d.name === 'ledgerland-exam-read')) return 0;
    return new Promise<number>((resolve) => {
      const req = indexedDB.open('ledgerland-exam-read');
      req.onerror = () => resolve(0);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('marks')) {
          db.close();
          return resolve(0);
        }
        const count = db.transaction('marks').objectStore('marks').count();
        count.onsuccess = () => {
          db.close();
          resolve(count.result);
        };
        count.onerror = () => {
          db.close();
          resolve(0);
        };
      };
    });
  });
}

async function allQuestions(request: APIRequestContext, idx: Index): Promise<Map<string, Question>> {
  const maps = await Promise.all(idx.decks.map((d) => deckQuestions(request, d)));
  return new Map(maps.flatMap((m) => [...m]));
}

test.describe('期中考苦練', () => {
  test('首頁與「我的」的入口；苦練首頁的三步（先讀題、再自己練、最後模擬考），新來的人建議從讀題開始；講義卡', async ({ page, request }) => {
    const idx = await index(request);
    const d1 = idx.decks.find((d) => d.id === 'd1')!;
    const first = d1.sections[0]!.questionIds[0]!;
    await clearAll(page);
    await page.getByTestId('home-exam').click();
    await expect(page).toHaveURL(/\/exam\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('期中考苦練');
    // 三張步驟卡的順序；新來的人：只有第 1 步掛「建議」，主要按鈕直接進第一題
    await expect(page.getByTestId('exam-route')).toHaveText('建議的順序：先讀題，再自己練，最後模擬考。');
    await expect(page.locator('section[data-testid^="exam-step-"] > h2')).toHaveText(['先讀題', '再自己練', '最後模擬考']);
    await expect(page.getByTestId('exam-step-recommended')).toHaveCount(1);
    await expect(page.getByTestId('exam-step-read').getByTestId('exam-step-recommended')).toHaveText('建議從這裡開始');
    await expect(page.getByTestId('exam-read-count')).toHaveText('還沒開始讀');
    await expect(page.getByTestId('exam-read-go')).toHaveText('從第一題開始讀');
    await expect(page.getByTestId('exam-read-go')).toHaveAttribute('href', new RegExp(`/exam/browse/\\?q=${first}$`));
    await expect(page.getByTestId('exam-progress')).toHaveText('還沒開始練');
    await expect(page.getByTestId('exam-start-order')).toHaveAttribute('href', /\/exam\/all\/$/);
    await expect(page.getByTestId('exam-start-random')).toHaveAttribute('href', /\/exam\/all\/\?order=random$/);
    await expect(page.getByTestId('exam-start-wrong')).toBeDisabled();
    await expect(page.getByTestId('exam-start-unsure')).toBeDisabled();
    await expect(page.getByTestId('exam-more-mock')).toHaveAttribute('href', /\/exam\/mock\/$/);
    await expect(page.getByTestId('exam-more-mock')).toHaveText('開始模擬考');
    await expect(page.getByTestId('exam-mock-last')).toHaveCount(0);
    await expect(page.getByTestId('exam-more-browse')).toHaveAttribute('href', /\/exam\/browse\/$/);
    await expect(page.getByTestId('exam-more-list')).toHaveAttribute('href', /\/exam\/list\/$/);
    await expect(page.getByRole('switch', { name: '打亂選項順序' })).not.toBeChecked();
    for (const d of idx.decks) {
      await expect(page.getByTestId(`exam-deck-${d.id}`)).toContainText(`講義 ${d.code}`);
      await expect(page.getByTestId(`exam-deck-count-${d.id}`)).toHaveText(`已讀 0／${d.questionCount} 題，練過 0／${d.questionCount} 題，熟練 0`);
      await expect(page.getByTestId(`exam-deck-read-${d.id}`)).toHaveAttribute('href', new RegExp(`/exam/browse/\\?deck=${d.id}$`));
    }
    await page.getByTestId('exam-deck-d1').locator('summary', { hasText: '各段分開練' }).click();
    await expect(page.getByTestId(`exam-section-${idx.decks[0]!.sections[0]!.id}`)).toBeVisible();
    // 第 1 步的主要按鈕：不用先進清單，直接是第一題
    await page.getByTestId('exam-read-go').click();
    await expect(page.getByTestId('exam-reader')).toHaveAttribute('data-question', first);
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
    // 第 1 題答錯：隔 3 題再出一次（後面不夠就排在最後），所以這一輪多一格
    const again = Math.min(4, total);
    const slots = [...section.questionIds.slice(0, again), section.questionIds[0]!, ...section.questionIds.slice(again)];
    for (let i = 0; i < slots.length; i++) {
      const q = qs.get(slots[i]!)!;
      await expect(card(page)).toContainText(`第 ${i + 1} 題，共 ${i === 0 ? total : total + 1} 題`);
      await expect(page.getByTestId('exam-retry-tag')).toHaveCount(i === again ? 1 : 0);
      // 講義順序：選項前帶字母，確認前就看得到；沒有「講義的 X」標籤
      await expect(card(page).locator('.ll-exam-letter')).toHaveText(['A.', 'B.', 'C.']);
      await expect(card(page).locator('.ll-exam-letter-tag')).toHaveCount(0);
      await expect(card(page).locator('.ll-exam-scenario')).toContainText('情境');
      const correct = i !== 0;
      await answerOne(page, q, correct);
      if (i === 0) await expect(page.getByTestId('exam-stage-note')).toHaveText('放進錯題複習了，隔幾題會再出一次。');
      if (i === again) await expect(page.getByTestId('exam-stage-note')).toHaveText('訂正成功，再連對 1 次就熟練。');
      await expect(page.getByText(`正確答案：${q.answer.join('、')}`)).toBeVisible();
      await expect(page.getByText('解析出自講義')).toBeVisible();
      await expect(page.locator('.ll-exam-explain .ll-handout-text')).toHaveAttribute('lang', 'zh-TW');
      await goNext(page);
    }
    await expect(page.getByTestId('exam-summary')).toBeVisible();
    // 成績以題為單位：再出現的那一次不算進題數，另一行寫加練與訂正
    await expect(page.getByTestId('exam-score')).toHaveText(`答對 ${total - 1}／${total} 題`);
    await expect(page.getByTestId('exam-summary-retried')).toHaveText('答錯的題在這一輪加練了 1 次，訂正成功 1 題');
    await expect(page.getByTestId('exam-summary').getByText('這一輪已訂正')).toBeVisible();
    await expect(page.getByTestId('exam-retry-wrong')).toContainText('到錯題複習訂正（1 題）');
    // 首頁的統計跟著變；只練錯過的只有那一題
    await page.goto('/exam/');
    await waitForApp(page);
    await expect(page.getByTestId('exam-progress')).toContainText(`練過 ${total}／${idx.questionCount} 題`);
    // 作答過之後，建議的步驟移到第 2 步
    await expect(page.getByTestId('exam-step-recommended')).toHaveCount(1);
    await expect(page.getByTestId('exam-step-practise').getByTestId('exam-step-recommended')).toHaveText('建議下一步');
    await expect(page.getByTestId('exam-start-wrong')).toContainText('練今天的錯題（1 題）');
    await page.getByTestId('exam-start-wrong').click();
    await expect(page).toHaveURL(/\/exam\/wrong\/$/);
    await expect(card(page)).toContainText('第 1 題，共 1 題');
    // 同一輪訂正過一次，這一輪再對一次就熟練、離開錯題複習
    await answerOne(page, qs.get(section.questionIds[0]!)!, true);
    await expect(page.getByTestId('exam-stage-note')).toHaveText('熟練了，這一題從錯題複習畢業。');
    await goNext(page);
    await expect(page.getByTestId('exam-score')).toHaveText('答對 1／1 題');
    await expect(page.getByTestId('exam-summary-retried')).toHaveCount(0);
    await expect(page.getByTestId('exam-retry-wrong')).toHaveCount(0);
  });

  test('答錯的題排回同一輪：隔 3 題再出一次並標「再試一次」，答對後不再出；離開再回來排回的題還在', async ({ page, request }) => {
    const idx = await index(request);
    const d1 = idx.decks.find((d) => d.id === 'd1')!;
    const qs = await deckQuestions(request, d1);
    const ids = d1.sections.flatMap((s) => s.questionIds);
    const total = ids.length;
    const tag = page.getByTestId('exam-retry-tag');
    const note = page.getByTestId('exam-stage-note');
    await clearAll(page);
    await page.goto('/exam/d1/');
    await waitForApp(page);
    await answerOne(page, qs.get(ids[0]!)!, true);
    await goNext(page);
    // 第 2 題答錯：這一輪多一格
    await expect(card(page)).toContainText(`第 2 題，共 ${total} 題`);
    await answerOne(page, qs.get(ids[1]!)!, false);
    await expect(note).toHaveText('放進錯題複習了，隔幾題會再出一次。');
    await expect(card(page)).toContainText(`第 2 題，共 ${total + 1} 題`);
    await goNext(page);
    // 中間隔 3 題，都不是再出現的
    for (let i = 2; i < 5; i++) {
      await expect(tag).toHaveCount(0);
      await answerOne(page, qs.get(ids[i]!)!, true);
      await goNext(page);
    }
    // 離開再回來：接續上次，下一題就是排回來的那一題
    await page.goto('/exam/');
    await waitForApp(page);
    await page.goto('/exam/d1/');
    await waitForApp(page);
    await expect(page.getByTestId('exam-resume')).toContainText('接續上次，從第 6 題開始');
    await expect(card(page)).toContainText(`第 6 題，共 ${total + 1} 題`);
    await expect(tag).toHaveText('再試一次');
    await answerOne(page, qs.get(ids[1]!)!, true);
    await expect(note).toHaveText('訂正成功，再連對 1 次就熟練。');
    await goNext(page);
    // 答對後這一輪不再出：下一題是原本的第 6 題，題數不再增加
    await expect(card(page)).toContainText(`第 7 題，共 ${total + 1} 題`);
    await expect(tag).toHaveCount(0);
    await answerOne(page, qs.get(ids[5]!)!, true);
    // 那一題訂正過一次，在錯題複習的複習中
    await page.goto('/exam/');
    await waitForApp(page);
    await expect(page.getByTestId('exam-wrong-counts')).toHaveText('待訂正 0 題、複習中 1 題、已熟練 0 題');
  });

  test('錯題複習：再答錯的題下一輪還在、排在最前面；訂正、再練下一輪、熟練；反覆答錯的題當天連對兩次後明天再練，隔天答對才熟練', async ({ page, request }) => {
    // 這一條走完整個流程，作答二十幾次：CI 的 WebKit 原本就要 46 秒，加上同一輪再出現的兩次之後超過預設的 60 秒
    test.setTimeout(150_000);
    const idx = await index(request);
    const d1 = idx.decks.find((d) => d.id === 'd1')!;
    const qs = await deckQuestions(request, d1);
    const [a, b, c] = d1.sections[0]!.questionIds.slice(0, 3).map((id) => qs.get(id)!) as [Question, Question, Question];
    const note = page.getByTestId('exam-stage-note');
    await clearAll(page);
    // 第一輪：前三題都答錯，每一題都說放進錯題複習了
    await page.goto('/exam/all/');
    await waitForApp(page);
    for (const q of [a, b, c]) {
      await answerOne(page, q, false);
      await expect(note).toHaveText('放進錯題複習了，隔幾題會再出一次。');
      await goNext(page);
    }
    // 錯題複習：第 1 題再答錯就離開。回來要依目前的錯題重新出題，再答錯的那一題還在第一個
    await page.goto('/exam/wrong/');
    await waitForApp(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('錯題複習');
    await expect(card(page)).toContainText('第 1 題，共 3 題');
    await answerOne(page, a, false);
    await expect(note).toHaveText('這一題第 2 次答錯，隔幾題會再出一次。');
    await goNext(page);
    await page.goto('/exam/');
    await waitForApp(page);
    await expect(page.getByTestId('exam-wrong-counts')).toHaveText('待訂正 3 題、複習中 0 題、已熟練 0 題');
    await expect(page.getByTestId('exam-start-wrong')).toHaveText('練今天的錯題（3 題）');
    await page.getByTestId('exam-start-wrong').click();
    await waitForApp(page);
    await expect(page.getByTestId('exam-resume')).toHaveCount(0);
    await expect(card(page)).toContainText('第 1 題，共 3 題');
    // 這一輪練完：第 1 題第三次答錯（排到最後再出一次），另外兩題訂正
    await answerOne(page, a, false);
    await expect(card(page)).toContainText('第 1 題，共 4 題');
    await goNext(page);
    await answerOne(page, b, true);
    await expect(note).toHaveText('訂正成功，再連對 1 次就熟練。');
    await goNext(page);
    await answerOne(page, c, true);
    await goNext(page);
    // 第 1 題再出現：又答錯就再排一次；同一題一輪最多再出兩次，第三次還錯就留給下一輪
    await expect(card(page)).toContainText('第 4 題，共 4 題');
    await expect(page.getByTestId('exam-retry-tag')).toHaveText('再試一次');
    await answerOne(page, a, false);
    await expect(note).toHaveText('這一題第 4 次答錯，隔幾題會再出一次。');
    await goNext(page);
    await expect(card(page)).toContainText('第 5 題，共 5 題');
    await expect(page.getByTestId('exam-retry-tag')).toHaveText('再試一次');
    await answerOne(page, a, false);
    await expect(note).toHaveText('這一題第 5 次答錯，會多安排幾次練習。');
    await expect(card(page)).toContainText('第 5 題，共 5 題');
    await goNext(page);
    await expect(page.getByTestId('exam-score')).toHaveText('答對 2／3 題');
    await expect(page.getByTestId('exam-summary-retried')).toHaveText('答錯的題在這一輪加練了 2 次，訂正成功 0 題');
    await expect(page.getByTestId('exam-summary-stages')).toHaveText('這一輪的錯題：已熟練 0 題、複習中 2 題、待訂正 1 題');
    await expect(page.getByTestId('exam-restart')).toHaveCount(0);
    // 再練下一輪：同一頁直接出新的一輪；待訂正的排最前面，訂正過的還要再對一次
    await expect(page.getByTestId('exam-retry-wrong')).toHaveText('再練下一輪（還有 3 題）');
    await page.getByTestId('exam-retry-wrong').click();
    await expect(page.getByTestId('exam-summary')).toHaveCount(0);
    await expect(card(page)).toContainText('第 1 題，共 3 題');
    await answerOne(page, a, true);
    await expect(note).toHaveText('訂正成功，再連對 2 次就熟練。');
    await goNext(page);
    await answerOne(page, b, true);
    await expect(note).toHaveText('熟練了，這一題從錯題複習畢業。');
    await goNext(page);
    await answerOne(page, c, true);
    await goNext(page);
    await expect(page.getByTestId('exam-summary-stages')).toHaveText('這一輪的錯題：已熟練 2 題、複習中 1 題、待訂正 0 題');
    // 反覆答錯的那一題：當天連對兩次就先到這裡，明天再練
    await expect(page.getByTestId('exam-retry-wrong')).toHaveText('再練下一輪（還有 1 題）');
    await page.getByTestId('exam-retry-wrong').click();
    await expect(card(page)).toContainText('第 1 題，共 1 題');
    await answerOne(page, a, true);
    await expect(note).toHaveText('今天先到這裡，明天再答對一次就熟練。');
    await goNext(page);
    await expect(page.getByTestId('exam-retry-wrong')).toHaveCount(0);
    await expect(page.getByTestId('exam-summary-waiting')).toHaveText('今天的錯題都練完了，還有 1 題明天再練。');
    await page.goto('/exam/');
    await waitForApp(page);
    await expect(page.getByTestId('exam-wrong-counts')).toHaveText('待訂正 0 題、複習中 1 題、已熟練 2 題');
    await expect(page.getByTestId('exam-start-wrong')).toBeDisabled();
    await expect(page.getByTestId('exam-start-wrong')).toHaveText('今天的錯題練完了（明天再練 1 題）');
    await expect(page.getByTestId('exam-progress')).toContainText('熟練 2 題');
    // 今天沒有要練的：完成的畫面；還是想練可以再練一次（純練習，升不了級）
    await page.goto('/exam/wrong/');
    await waitForApp(page);
    await expect(page.getByText('今天的錯題都練完了')).toBeVisible();
    await page.getByTestId('exam-wrong-all').click();
    await expect(page).toHaveURL(/\/exam\/wrong\/\?all=1$/);
    await waitForApp(page);
    await expect(card(page)).toContainText('第 1 題，共 1 題');
    await answerOne(page, a, true);
    await expect(note).toHaveText('今天先到這裡，明天再答對一次就熟練。');
    // 隔天：把那一題的作答時間往前撥兩天（不改時鐘），它回到今天要練的題，答對一次就熟練
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString();
    await patchState(page, a.id, { lastAt: twoDaysAgo, lastWrongAt: twoDaysAgo });
    await page.goto('/exam/');
    await waitForApp(page);
    await expect(page.getByTestId('exam-start-wrong')).toHaveText('練今天的錯題（1 題）');
    await page.getByTestId('exam-start-wrong').click();
    await waitForApp(page);
    await answerOne(page, a, true);
    await expect(note).toHaveText('熟練了，這一題從錯題複習畢業。');
    await goNext(page);
    await expect(page.getByTestId('exam-summary-stages')).toHaveText('這一輪的錯題：已熟練 1 題、複習中 0 題、待訂正 0 題');
    await expect(page.getByTestId('exam-retry-wrong')).toHaveCount(0);
    await page.goto('/exam/wrong/');
    await waitForApp(page);
    await expect(page.getByText('沒有要練的錯題')).toBeVisible();
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

  test('錯題複習的清單：空狀態、進度、最需要加強的地方、三個分頁與每題離熟練還差什麼、展開看我選的與解析、拿去練；noindex', async ({ page, request }) => {
    const idx = await index(request);
    const d1 = idx.decks.find((d) => d.id === 'd1')!;
    const section = d1.sections[0]!;
    const qs = await deckQuestions(request, d1);
    const ids = section.questionIds;
    await clearAll(page);
    await page.goto('/exam/list/');
    await waitForApp(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('錯題複習');
    await expect(page.getByText('還沒有錯題')).toBeVisible();
    await expect(page.getByTestId('exam-list-practise')).toHaveCount(0);
    await expect(page.locator('meta[name="robots"][data-ll]')).toHaveAttribute('content', 'noindex');
    // 第 1、2 題答錯，第 3 題答對（沒答錯過，不進清單）
    await page.goto(`/exam/${section.id}/`);
    await waitForApp(page);
    const wrongLetter = await answerOne(page, qs.get(ids[0]!)!, false);
    await goNext(page);
    await answerOne(page, qs.get(ids[1]!)!, false);
    await goNext(page);
    await answerOne(page, qs.get(ids[2]!)!, true);
    // 錯題複習：第 1 題再答錯（反覆答錯），第 2 題訂正（複習中）
    await page.goto('/exam/wrong/');
    await waitForApp(page);
    await answerOne(page, qs.get(ids[0]!)!, false);
    await goNext(page);
    await answerOne(page, qs.get(ids[1]!)!, true);
    await page.goto('/exam/list/');
    await waitForApp(page);
    await expect(page.getByTestId('exam-list-progress')).toHaveText('答錯過 2 題，已熟練 0 題');
    await expect(page.getByTestId('exam-list-practise')).toHaveText('練今天的錯題（2 題）');
    await expect(page.getByTestId('exam-list-practise')).toHaveAttribute('href', /\/exam\/wrong\/$/);
    // 最需要加強的地方：這一段有 2 題還沒熟練，連到這一段的練習
    const weak = page.getByTestId('exam-weak-sections').locator('li').first();
    await expect(weak).toContainText(section.title);
    await expect(weak).toContainText('還沒熟練 2 題');
    await expect(weak.getByRole('link')).toHaveAttribute('href', new RegExp(`/exam/${section.id}/$`));
    // 待訂正：反覆答錯的那一題
    await expect(page.getByRole('radio', { name: '待訂正 1' })).toBeChecked();
    const deck = page.getByTestId('exam-list-deck-d1');
    await expect(deck.locator('summary')).toHaveCount(1);
    await expect(deck.getByText('答錯 2 次')).toBeVisible();
    await expect(deck.getByText('反覆答錯：要連對 3 次，最後一次在隔天')).toBeVisible();
    await deck.locator('summary').first().click();
    const wrongOption = deck.locator('.ll-exam-q__option.is-wrong');
    await expect(wrongOption).toHaveCount(1);
    await expect(wrongOption).toContainText(`${wrongLetter}.`);
    await expect(wrongOption).toContainText('我選的');
    await expect(deck.locator('.ll-exam-q__option.is-correct')).toHaveCount(qs.get(ids[0]!)!.answer.length);
    await expect(deck.getByText('解析出自講義')).toBeVisible();
    // 複習中：訂正過一次的那一題；已熟練還沒有
    await page.getByRole('radio', { name: '複習中 1' }).click();
    await expect(page).toHaveURL(/\/exam\/list\/\?tab=review$/);
    await expect(deck.locator('summary')).toHaveCount(1);
    await expect(deck.getByText('答錯 1 次')).toBeVisible();
    await expect(deck.getByText('再連對 1 次就熟練')).toBeVisible();
    await page.getByRole('radio', { name: '已熟練 0' }).click();
    await expect(page.getByTestId('exam-list-none')).toBeVisible();
    // 首頁的連結
    await page.goto('/exam/');
    await waitForApp(page);
    await expect(page.getByTestId('exam-more-list')).toContainText('看錯題複習的紀錄');
  });

  test('練習紀錄：空狀態；今天與近 7 天的數字、長條圖與表格；前一天也有練時是兩根長條與連續 2 天；近 30 天；入口；noindex', async ({ page, request }) => {
    const idx = await index(request);
    const d1 = idx.decks.find((d) => d.id === 'd1')!;
    const section = d1.sections[1]!;
    const qs = await deckQuestions(request, d1);
    const ids = section.questionIds;
    const readout = page.getByTestId('exam-daychart-readout');
    const bars = page.locator('.ll-daychart__col:has(.ll-daychart__seg)');
    await clearAll(page);
    await page.goto('/exam/history/');
    await waitForApp(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('練習紀錄');
    await expect(page.getByText('還沒有練習紀錄')).toBeVisible();
    await expect(page.getByTestId('exam-daychart')).toHaveCount(0);
    await expect(page.getByTestId('exam-history-device')).toContainText('只存在這台裝置');
    await expect(page.locator('meta[name="robots"][data-ll]')).toHaveAttribute('content', 'noindex');
    // 練三題：第 1 題對、第 2 題錯、第 3 題對
    await page.goto(`/exam/${section.id}/`);
    await waitForApp(page);
    await answerOne(page, qs.get(ids[0]!)!, true);
    await goNext(page);
    await answerOne(page, qs.get(ids[1]!)!, false);
    await goNext(page);
    await answerOne(page, qs.get(ids[2]!)!, true);
    // 從苦練首頁進來
    await page.goto('/exam/');
    await waitForApp(page);
    await page.getByTestId('exam-more-history').click();
    await expect(page).toHaveURL(/\/exam\/history\/$/);
    await waitForApp(page);
    await expect(page.getByTestId('exam-history-streak')).toHaveText('1 天');
    await expect(page.getByTestId('exam-history-today')).toHaveText('3 題');
    await expect(page.getByTestId('exam-history-week')).toHaveText('3 題');
    await expect(page.getByTestId('exam-history-tiles')).toContainText('答對率 67%');
    await expect(page.getByTestId('exam-history-compare')).toHaveCount(0);
    await expect(page.getByTestId('exam-history-mastered')).toHaveText('熟練 0 題');
    await expect(page.getByTestId('exam-history-fixed')).toHaveText('訂正成功 0 題');
    // 長條圖：預設說的是今天；只有今天那一根，答對與答錯兩段
    await expect(readout).toHaveText('今天：練了 3 題，答對 2 題、答錯 1 題');
    await expect(page.locator('.ll-daychart__col')).toHaveCount(14);
    await expect(bars).toHaveCount(1);
    await expect(bars.locator('.ll-daychart__seg')).toHaveCount(2);
    await expect(page.getByTestId('exam-history-progress')).toHaveText(`練過 3／${idx.questionCount} 題，熟練 0 題`);
    // 把第 1 題的作答撥到昨天：兩天都有練，連續 2 天；今天剩 2 題，近 7 天還是 3 題
    await shiftAttempts(page, ids[0]!, new Date(Date.now() - 86_400_000).toISOString());
    await page.reload();
    await waitForApp(page);
    await expect(page.getByTestId('exam-history-streak')).toHaveText('2 天');
    await expect(page.getByTestId('exam-history-today')).toHaveText('2 題');
    await expect(page.getByTestId('exam-history-week')).toHaveText('3 題');
    await expect(readout).toHaveText('今天：練了 2 題，答對 1 題、答錯 1 題');
    await expect(bars).toHaveCount(2);
    // 每天的數字：有練的日子各一列，新的在上面
    const table = page.getByTestId('exam-history-table');
    await table.locator('summary').click();
    await expect(table.locator('tbody tr')).toHaveCount(2);
    await expect(table.locator('tbody tr').first()).toContainText('今天');
    await expect(table.locator('tbody tr').first()).toContainText('50%');
    await expect(table.locator('tbody tr').nth(1)).toContainText('100%');
    // 近 30 天
    await page.getByRole('radio', { name: '近 30 天' }).click();
    await expect(page).toHaveURL(/\/exam\/history\/\?days=30$/);
    await expect(page.locator('.ll-daychart__col')).toHaveCount(30);
    await expect(bars).toHaveCount(2);
    // 錯題複習的清單頁也進得來
    await page.goto('/exam/list/');
    await waitForApp(page);
    await page.getByTestId('exam-list-history').getByRole('link').click();
    await expect(page).toHaveURL(/\/exam\/history\/$/);
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
    await expect.poll(() => readMarkCount(page)).toBe(2);
    await page.goto('/exam/');
    await waitForApp(page);
    // 苦練首頁的第 1 步：已讀幾題、「接著讀」直接到第三題；還沒作答過，所以建議接著讀；講義卡也寫已讀
    await expect(page.getByTestId('exam-read-count')).toHaveText(`已讀 2／${all} 題`);
    await expect(page.getByTestId('exam-read-go')).toHaveText(`接著讀（講義 ${d1.code}）`);
    await expect(page.getByTestId('exam-read-go')).toHaveAttribute('href', new RegExp(`/exam/browse/\\?deck=d1&q=${id3}$`));
    await expect(page.getByTestId('exam-step-read').getByTestId('exam-step-recommended')).toHaveText('建議接著讀');
    await expect(page.getByTestId('exam-deck-count-d1')).toContainText(`已讀 2／${d1.questionCount} 題`);
    await expect(page.getByTestId('exam-deck-count-d2')).toContainText(`已讀 0／${d2.questionCount} 題`);
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
    // 範圍的最後一題：按「讀完了」後是結束卡（先等復原的那一筆寫回資料庫再換頁）
    await expect.poll(() => readMarkCount(page)).toBe(1);
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

  test('背題瀏覽：關鍵字搜尋只列比中的題、標出比中的字、閱讀頁在結果裡翻頁、回清單還在、換範圍、沒有結果與清除', async ({ page, request }) => {
    const idx = await index(request);
    type Full = Question & { scenario: string; question: string; explanation: string; deck: string };
    const norm = (s: string) => s.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
    const byDeck = new Map<string, Full[]>();
    for (const d of idx.decks) {
      const file = (await (await request.get(`/${d.file}`)).json()) as { questions: Full[] };
      const order = d.sections.flatMap((s) => s.questionIds);
      byDeck.set(
        d.id,
        [...file.questions].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)),
      );
    }
    const hay = (q: Full) => [q.topic, q.scenario, q.question, ...q.options.map((o) => o.text), q.explanation].map(norm).join('\n');
    const decks = [...idx.decks].sort((x, y) => Number(x.id.slice(1)) - Number(y.id.slice(1)));
    const allInOrder = decks.flatMap((d) => byDeck.get(d.id)!);
    // 關鍵字：第一份講義裡一個沒有空白的標題（測試不寫死講義文字）
    const target = byDeck.get(decks[0]!.id)!.find((q) => !/\s/.test(q.topic) && q.topic.length >= 4)!;
    const keyword = target.topic;
    const hits = allInOrder.filter((q) => hay(q).includes(norm(keyword)));
    expect(hits.length).toBeGreaterThanOrEqual(1);
    const found = page.getByTestId('exam-browse-found');
    const rows = page.getByTestId('exam-browse-row');
    const box = page.getByRole('searchbox', { name: '搜尋題目' });
    const reader = page.getByTestId('exam-reader');
    await clearAll(page);
    await page.goto('/exam/browse/');
    await waitForApp(page);
    await expect(found).toBeHidden();
    await box.fill(keyword);
    await expect(found).toHaveText(`找到 ${hits.length} 題`);
    await expect(page).toHaveURL(/[?&]find=/);
    // 搜尋中：不顯示開始卡，只列比中的題，比中的字標出來
    await expect(page.getByTestId('exam-browse-start')).toHaveCount(0);
    await expect(rows).toHaveCount(hits.length);
    const row = page.locator(`#ll-exam-browse-row-${target.id}`);
    await expect(row.locator('mark')).toHaveText(keyword);
    // 點進去：位置與翻頁都照搜尋結果
    await row.click();
    await expect(reader).toHaveAttribute('data-question', target.id);
    const at = hits.findIndex((q) => q.id === target.id) + 1;
    await expect(page.getByTestId('exam-reader-pos')).toHaveText(`搜尋結果第 ${at}／${hits.length} 題`);
    if (at === 1) await expect(page.getByTestId('exam-reader-prev')).toBeDisabled();
    if (at === hits.length) await expect(page.getByTestId('exam-reader-next')).toBeDisabled();
    else {
      await page.getByTestId('exam-reader-next').click();
      await expect(reader).toHaveAttribute('data-question', hits[at]!.id);
    }
    // 回清單：搜尋的字與結果都還在
    await page.goBack();
    await expect(box).toHaveValue(keyword);
    await expect(found).toHaveText(`找到 ${hits.length} 題`);
    // 換範圍：只在那一份講義裡找
    const other = decks[1]!;
    const otherHits = byDeck.get(other.id)!.filter((q) => hay(q).includes(norm(keyword)));
    await page.getByRole('radio', { name: `講義 ${other.code}` }).click();
    if (otherHits.length > 0) await expect(found).toHaveText(`找到 ${otherHits.length} 題`);
    else await expect(page.getByTestId('exam-browse-empty')).toContainText(`找不到含有「${keyword}」的題目`);
    await expect(rows).toHaveCount(otherHits.length);
    // 沒有結果
    await box.fill('沒有這個詞qqq');
    await expect(page.getByTestId('exam-browse-empty')).toContainText('找不到含有「沒有這個詞qqq」的題目');
    await expect(rows).toHaveCount(0);
    await expect(found).toBeHidden();
    // 清除：回到平常的清單
    await page.getByRole('button', { name: '清除搜尋' }).click();
    await expect(page.getByTestId('exam-browse-start')).toBeVisible();
    await expect(page).not.toHaveURL(/find=/);
    await expect(box).toHaveValue('');
  });

  test('苦練徽章：讀完一份講義時跳提示並寫進進度；苦練首頁與徽章頁顯示，算進徽章頁的總數；不會重複頒發', async ({ page, request }) => {
    const idx = await index(request);
    const d2 = idx.decks.find((d) => d.id === 'd2')!;
    const ids = d2.sections.flatMap((sec) => sec.questionIds);
    const last = ids.at(-1)!;
    await clearAll(page);
    await page.goto('/exam/');
    await waitForApp(page);
    // 一開始六枚都還沒有；每一步各兩枚
    for (const step of ['read', 'practise', 'mock']) await expect(page.getByTestId(`exam-step-${step}`).locator('.ll-exam-badges__item')).toHaveCount(2);
    await expect(page.locator('.ll-exam-badges__item[data-state="done"]')).toHaveCount(0);
    await expect(page.getByTestId('exam-badge-readDeck')).toContainText('讀完一份');
    await expect(page.getByTestId('exam-badge-readDeck')).toContainText('（未取得）');
    // 把講義 0-2 除了最後一題都標成已讀（直接寫進已讀的資料庫；首頁已經開過，資料庫與 store 都在）
    await page.evaluate(
      async ({ file, questionIds }) => {
        const deck = (await (await fetch(`/${file}`)).json()) as { questions: { id: string; answerRev: number }[] };
        const revs = new Map(deck.questions.map((q) => [q.id, q.answerRev]));
        await new Promise<void>((resolve, reject) => {
          const req = indexedDB.open('ledgerland-exam-read');
          req.onerror = () => reject(req.error);
          req.onsuccess = () => {
            const tx = req.result.transaction('marks', 'readwrite');
            for (const id of questionIds) tx.objectStore('marks').put({ questionId: id, answerRev: revs.get(id), at: new Date().toISOString() });
            tx.oncomplete = () => {
              req.result.close();
              resolve();
            };
            tx.onerror = () => reject(tx.error);
          };
        });
      },
      { file: d2.file, questionIds: ids.slice(0, -1) },
    );
    // 讀最後一題：這一份讀完了，跳出取得徽章的提示
    await page.goto(`/exam/browse/?deck=d2&q=${last}`);
    await waitForApp(page);
    await page.getByTestId('exam-reader-done').click();
    await expect(page.getByTestId('exam-reader-end')).toContainText(`講義 ${d2.code} 都讀完了`);
    const toasts = page.getByTestId('exam-badge-toasts');
    await expect(toasts).toContainText('取得苦練徽章');
    await expect(toasts).toContainText('讀完一份');
    await expect(toasts).not.toContainText('讀遍題庫');
    await expect.poll(() => readMarkCount(page)).toBe(ids.length);
    // 苦練首頁：那一枚亮了，其他還沒；已經有了，不再跳提示
    await page.goto('/exam/');
    await waitForApp(page);
    await expect(page.getByTestId('exam-badge-readDeck')).toHaveAttribute('data-state', 'done');
    await expect(page.getByTestId('exam-badge-readDeck')).toContainText('（已取得）');
    await expect(page.locator('.ll-exam-badges__item[data-state="done"]')).toHaveCount(1);
    await expect(page.getByTestId('exam-badge-toasts')).not.toContainText('取得苦練徽章');
    // 徽章頁：苦練徽章自己一區、自己算 1／6；上面摘要卡的總數是章節、特別、苦練三類的合計，所以是 1／21
    await page.getByTestId('exam-badges-link').click();
    await waitForApp(page);
    const group = page.getByTestId('badges-exam');
    await expect(group.locator('h2')).toContainText('苦練徽章');
    await expect(group.locator('h2')).toContainText('1／6');
    await expect(group.locator('.ll-badges__item')).toHaveCount(6);
    await expect(group.locator('[data-exam-badge="readDeck"]')).toHaveAttribute('data-state', 'done');
    await expect(group.locator('[data-exam-badge="readDeck"]')).toContainText('取得');
    await expect(group.locator('[data-exam-badge="mockPass"]')).toHaveAttribute('data-state', 'locked');
    await expect(group.locator('[data-exam-badge="mockPass"]')).toContainText('一次 30 題以上的模擬考答對 80% 以上');
    await expect(page.locator('.ll-badges__count')).toContainText('已取得 1／21 枚');
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
    // 預設 40 題、每題 60 秒；題數只有 40、50、100
    await expect(page.getByTestId('exam-mock-plan')).toHaveText('共 40 題，限時 40 分 0 秒，時間到自動交卷。');
    await page
      .getByRole('radiogroup', { name: '範圍' })
      .getByRole('radio', { name: `講義 ${d2.code}` })
      .click();
    await expect(page.getByRole('radiogroup', { name: '題數' }).getByRole('radio')).toHaveText(['40', '50', '100']);
    // 只考一份講義時，超過該份題數的選項抽整份
    await page.getByRole('radiogroup', { name: '題數' }).getByRole('radio', { name: '100' }).click();
    await page.getByRole('radiogroup', { name: '每題時間' }).getByRole('radio', { name: '不限時' }).click();
    await expect(page.getByTestId('exam-mock-plan')).toHaveText(`共 ${d2.questionCount} 題，不限時。`);
    await page.getByRole('radiogroup', { name: '題數' }).getByRole('radio', { name: '50' }).click();
    await expect(page.getByTestId('exam-mock-plan')).toHaveText('共 50 題，不限時。');
    await page.getByTestId('exam-mock-start').click();
    await expect(card(page)).toContainText('第 1 題，共 50 題');
    await expect(page.getByTestId('exam-mock-status')).toHaveText('已作答 0／50 題');
    await expect(page.getByTestId('exam-mock-timer')).toHaveCount(0);
    const run = (await mockRun(page))!;
    expect(run.questionIds).toHaveLength(50);
    for (const id of run.questionIds) expect(d2.sections.flatMap((s) => s.questionIds)).toContain(id);
    const q1 = qs.get(run.questionIds[0]!)!;
    const q2 = qs.get(run.questionIds[1]!)!;
    const indexOf = (q: Question, letter: string) => q.options.findIndex((o) => o.letter === letter);
    const wrongOf = (q: Question) => q.options.map((o) => o.letter).find((l) => !q.answer.includes(l))!;
    // 第 1 題先選錯的：沒有回饋，主按鈕是「下一題」
    await radios(page)
      .nth(indexOf(q1, wrongOf(q1)))
      .check();
    await expect(page.getByTestId('exam-mock-status')).toHaveText('已作答 1／50 題');
    await expect(feedbackTitle(page)).toHaveCount(0);
    await card(page).getByRole('button', { name: '下一題' }).click();
    await expect(card(page)).toContainText('第 2 題，共 50 題');
    await radios(page)
      .nth(indexOf(q2, wrongOf(q2)))
      .check();
    // 沒選也能跳過；上一題回來選擇還在，可以改選
    await card(page).getByRole('button', { name: '下一題' }).click();
    await card(page).getByRole('button', { name: '下一題' }).click();
    await expect(card(page)).toContainText('第 4 題，共 50 題');
    for (let i = 0; i < 3; i++) await page.getByTestId('exam-mock-prev').click();
    await expect(card(page)).toContainText('第 1 題，共 50 題');
    await expect(page.getByTestId('exam-mock-prev')).toBeDisabled();
    await expect(radios(page).nth(indexOf(q1, wrongOf(q1)))).toBeChecked();
    await radios(page).nth(indexOf(q1, q1.answer[0]!)).check();
    await expect(page.getByTestId('exam-mock-status')).toHaveText('已作答 2／50 題');
    // 交卷：先確認，取消不交
    await page.getByTestId('exam-mock-submit').click();
    const sheet = page.getByTestId('exam-mock-confirm');
    await expect(sheet).toContainText('還有 48 題沒作答');
    await sheet.getByRole('button', { name: '取消' }).click();
    await expect(page.getByTestId('exam-mock-result')).toHaveCount(0);
    await page.getByTestId('exam-mock-submit').click();
    await sheet.getByRole('button', { name: '交卷' }).click();
    await expect(page.getByTestId('exam-mock-score')).toHaveText('答對 1／50 題（2%）');
    await expect(page.getByTestId('exam-mock-detail')).toContainText('48 題沒作答');
    await expect(page.getByTestId('exam-mock-expired')).toHaveCount(0);
    const items = page.getByTestId('exam-mock-items').locator('summary');
    await expect(items).toHaveCount(50);
    await expect(page.getByTestId('exam-mock-items').getByText('答對', { exact: true })).toHaveCount(1);
    await expect(page.getByTestId('exam-mock-items').getByText('沒作答', { exact: true })).toHaveCount(48);
    await page.getByRole('radio', { name: '答錯與沒作答 49' }).click();
    await expect(items).toHaveCount(49);
    await items.first().click();
    const firstWrong = page.getByTestId('exam-mock-items').locator('.ll-exam-q').first();
    await expect(firstWrong.locator('.ll-exam-q__option.is-wrong')).toContainText('我選的');
    await expect(firstWrong.getByText('解析出自講義')).toBeVisible();
    await expect(page.getByTestId('exam-mock-wrong')).toHaveText('到錯題複習訂正（1 題）');
    // 重新整理成績還在；作答過的兩題進了紀錄，沒選的不算
    await expect.poll(() => seenOf(page, q2.id)).toBe(1);
    await page.reload();
    await waitForApp(page);
    await expect(page.getByTestId('exam-mock-score')).toHaveText('答對 1／50 題（2%）');
    await page.goto('/exam/');
    await waitForApp(page);
    await expect(page.getByTestId('exam-progress')).toContainText(`練過 2／${idx.questionCount} 題`);
    await expect(page.getByTestId('exam-start-wrong')).toContainText('練今天的錯題（1 題）');
    // 第 3 步：寫著上次的成績，按鈕回到成績頁
    await expect(page.getByTestId('exam-mock-last')).toHaveText('上次模擬考：答對 1／50 題');
    // 模擬考答錯的題進了錯題複習（沒作答的不算）：第 3 步寫著還有幾題沒熟練，可以直接去訂正
    await expect(page.getByTestId('exam-mock-wrong-note')).toHaveText('上次答錯的 1 題已放進錯題複習，還有 1 題沒熟練。');
    await expect(page.getByTestId('exam-mock-to-wrong')).toHaveAttribute('href', /\/exam\/wrong\/$/);
    // 交過一場模擬考：有「初次上場」；答對不到八成，沒有「模擬考過關」
    await expect(page.getByTestId('exam-badge-mockFirst')).toHaveAttribute('data-state', 'done');
    await expect(page.getByTestId('exam-badge-mockPass')).toHaveAttribute('data-state', 'locked');
    await expect(page.getByTestId('exam-more-mock')).toHaveText('看成績，或再考一次');
    // 換設定：回到設定畫面，記得上次選的
    await page.goto('/exam/mock/');
    await waitForApp(page);
    await page.getByTestId('exam-mock-resetup').click();
    await expect(page.getByTestId('exam-mock-setup')).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: '題數' }).getByRole('radio', { name: '50' })).toBeChecked();
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
    await expect(card(page)).toContainText('第 1 題，共 40 題');
    await expect(page.getByTestId('exam-mock-timer')).toHaveText(/^剩 (39|40) 分 \d+ 秒$/);
    const run = (await mockRun(page))!;
    const q1 = qs.get(run.questionIds[0]!)!;
    await radios(page)
      .nth(q1.options.findIndex((o) => o.letter === q1.answer[0]))
      .check();
    await expect(page.getByTestId('exam-mock-status')).toHaveText('已作答 1／40 題');
    await card(page).getByRole('button', { name: '下一題' }).click();
    await expect(card(page)).toContainText('第 2 題，共 40 題');
    // 這一輪是非同步寫進 IndexedDB 的：等「走到第 2 題」落地才整頁導航，不和寫入競速
    await expect.poll(async () => (await mockRun(page))?.index).toBe(1);
    // 離開再回來：接續同一場，停在第 2 題
    await page.goto('/exam/');
    await waitForApp(page);
    await page.goto('/exam/mock/');
    await waitForApp(page);
    await expect(page.getByTestId('exam-mock-resume')).toContainText('接續上次的模擬考');
    await expect(card(page)).toContainText('第 2 題，共 40 題');
    await expect(page.getByTestId('exam-mock-status')).toHaveText('已作答 1／40 題');
    // 把期限撥到 3 秒後：倒數到 0 自動交卷，成績照已作答的算
    await mockRun(page, { deadlineAt: new Date(Date.now() + 3000).toISOString() });
    await page.reload();
    await waitForApp(page);
    await expect(page.getByTestId('exam-mock-expired')).toHaveText('時間到，已自動交卷。', { timeout: 15_000 });
    await expect(page.getByTestId('exam-mock-score')).toHaveText('答對 1／40 題（3%）');
    await expect(page.getByTestId('exam-mock-detail')).toContainText('39 題沒作答');
    // 模擬考交了卷：拿到苦練徽章「初次上場」（答對不到八成，沒有「模擬考過關」）
    await expect(page.getByTestId('exam-badge-toasts')).toContainText('取得苦練徽章');
    await expect(page.getByTestId('exam-badge-toasts')).toContainText('初次上場');
    await expect(page.getByTestId('exam-badge-toasts')).not.toContainText('模擬考過關');
    // 期限已過才回來：直接看到成績，不再是作答畫面
    await page.reload();
    await waitForApp(page);
    await expect(page.getByTestId('exam-mock-score')).toHaveText('答對 1／40 題（3%）');
    // 再考一次沿用 40 題、每題 60 秒
    await page.getByTestId('exam-mock-again').click();
    await expect(card(page)).toContainText('第 1 題，共 40 題');
    await expect(page.getByTestId('exam-mock-timer')).toBeVisible();
    await expect(page.getByTestId('exam-mock-status')).toHaveText('已作答 0／40 題');
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
      await expect(page.getByTestId('exam-start-wrong')).toContainText('練今天的錯題（1 題）');
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
    await expect(page.getByTestId('exam-notes')).toContainText('The question bank is in Chinese only.');
    await expect(page.locator('section[data-testid^="exam-step-"] > h2')).toHaveText(['Read the questions first', 'Then practise', 'Finish with a mock exam']);
    await page.goto('/en/exam/d1s1/');
    await waitForApp(page);
    await expect(card(page).getByRole('button', { name: 'Check answer' })).toBeVisible();
    await expect(card(page).locator('.ll-exam-scenario .ll-handout-text')).toHaveAttribute('lang', 'zh-TW');
    await page.goto('/exam/nope/');
    await waitForApp(page);
    await expect(page.getByText('沒有這一組題目')).toBeVisible();
  });
});
