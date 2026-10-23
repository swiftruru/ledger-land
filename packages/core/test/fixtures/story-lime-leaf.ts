// 青檸文具社（04 第 17 節）：repo 內的測試故事，自編數字、原創敘述，只用在測試，不進發布快照。
// 步驟 ID 依 04 第 17 節的表（第 6、7、9、10、12、15、17 步），其餘自取合法的 st_ ID。
import type { Story, StoryStep } from '../../src/story/types.ts';

type Event = StoryStep['events'][number];

function step(
  id: string,
  order: number,
  title: { 'zh-TW': string; en: string },
  narrative: { 'zh-TW': string; en: string },
  events: Event[],
  termRefs: string[],
  checkpoints?: { ref: string; value: number }[],
): StoryStep {
  return { id, order, title, narrative, events, termRefs, ...(checkpoints === undefined ? {} : { checkpoints }) };
}

export const LIME_LEAF_STEP_IDS = {
  issueShares: 'st_a1b2c3',
  officeSupplies: 'st_d4e5f6',
  equipment: 'st_g7h8j9',
  outsourcing: 'st_k2m3n4',
  orgCosts: 'st_p5q6r7',
  purchaseCash: 'st_p4n7e2',
  sellCash: 'st_h8q3z6',
  borrow: 'st_s8t9v2',
  purchaseCredit: 'st_j3v9k2',
  sellCredit: 'st_c6w1q4',
  payPayables: 'st_w3x4y5',
  collect: 'st_m2x8r5',
  directors: 'st_z6a7b8',
  packing: 'st_c9d2e3',
  repay: 'st_w4r8n2',
  count: 'st_f4g5h6',
  yearEnd: 'st_y5c1h8',
  incomeTax: 'st_j7k8m9',
} as const;

const S = LIME_LEAF_STEP_IDS;

export const limeLeafStory: Story = {
  id: 'story_q7m2v9',
  rev: 1,
  revKind: 'text',
  status: 'published',
  title: { 'zh-TW': '青檸文具社的第一年', en: 'Lime Leaf Stationery, year one' },
  origin: 'original',
  company: { name: { 'zh-TW': '青檸文具社', en: 'Lime Leaf Stationery' } },
  ledger: { currency: 'TWD', scale: 0 },
  policy: 'teacher@1',
  layout: 'teacher@1',
  steps: [
    step(
      S.issueShares,
      1,
      { 'zh-TW': '成立公司', en: 'Founding the company' },
      {
        'zh-TW': '三位朋友湊錢成立青檸文具社，把股款存進公司帳戶。',
        en: 'Three friends pool their savings to found Lime Leaf Stationery and deposit the share capital.',
      },
      [{ id: 'e1', template: 'tpl.issue_shares_cash', params: { amount: 2400000 } }],
      ['tm_c4sh8k2p', 'tm_5e3py55a'],
    ),
    step(
      S.officeSupplies,
      2,
      { 'zh-TW': '買事務用品', en: 'Buying office supplies' },
      { 'zh-TW': '開店前先買了一批文具與紙張自用。', en: 'Before opening, the shop buys pens and paper for its own use.' },
      [{ id: 'e1', template: 'tpl.buy_office_supplies_cash', params: { amount: 36000 } }],
      ['tm_24scevxv'],
    ),
    step(
      S.equipment,
      3,
      { 'zh-TW': '買電腦設備', en: 'Buying computer equipment' },
      { 'zh-TW': '收銀與庫存系統需要兩台電腦，預計用四年。', en: 'The till and stock system need two computers, expected to last four years.' },
      [{ id: 'e1', template: 'tpl.buy_equipment_cash', params: { amount: 360000 } }],
      ['tm_gt8g4afe'],
    ),
    step(
      S.outsourcing,
      4,
      { 'zh-TW': '外包網頁', en: 'Outsourcing the website' },
      { 'zh-TW': '請設計工作室做了一個線上型錄。', en: 'A design studio is hired to build an online catalogue.' },
      [{ id: 'e1', template: 'tpl.pay_outsourcing_cash', params: { amount: 120000 } }],
      ['tm_r3nvm8jy'],
    ),
    step(
      S.orgCosts,
      5,
      { 'zh-TW': '付設立費', en: 'Paying start-up costs' },
      {
        'zh-TW': '登記、刻章與法律顧問的費用一次付清，預計分五年攤銷。',
        en: 'Registration, seals and legal advice are paid at once and will be amortised over five years.',
      },
      [{ id: 'e1', template: 'tpl.pay_org_costs', params: { amount: 150000 }, pendingRefs: ['T04'] }],
      ['tm_d9f3g7cs'],
    ),
    step(
      S.purchaseCash,
      6,
      { 'zh-TW': '現金進貨', en: 'Buying inventory for cash' },
      { 'zh-TW': '第一批筆記本與鋼筆以現金向批發商買進。', en: 'The first batch of notebooks and fountain pens is bought from a wholesaler for cash.' },
      [{ id: 'e1', template: 'tpl.purchase_inventory_cash', params: { amount: 640000 } }],
      ['tm_n7v3k8pq'],
    ),
    step(
      S.sellCash,
      7,
      { 'zh-TW': '以現金賣出全部存貨', en: 'Selling all inventory for cash' },
      { 'zh-TW': '一家連鎖書店一次買走倉庫裡所有的貨。', en: 'A bookstore chain buys everything in the warehouse in one go.' },
      [{ id: 'e1', template: 'tpl.sell_all_inventory_cash', params: { price: 1120000 } }],
      ['tm_v3n8q2ye', 'tm_g5c2m8tw'],
      [
        { ref: 'e1.costOfAllInventory', value: 640000 },
        { ref: 'e1.grossProfit', value: 480000 },
      ],
    ),
    step(
      S.borrow,
      8,
      { 'zh-TW': '向銀行借款', en: 'Borrowing from the bank' },
      { 'zh-TW': '為了接更大的訂單，向銀行借了一筆一年內要還的錢。', en: 'To take on bigger orders, the shop borrows from the bank, repayable within a year.' },
      [{ id: 'e1', template: 'tpl.borrow_short_term', params: { amount: 900000 } }],
      ['tm_s5b8r3hd'],
    ),
    step(
      S.purchaseCredit,
      9,
      { 'zh-TW': '賒購', en: 'Buying inventory on credit' },
      { 'zh-TW': '批發商同意先出貨、月底再結帳。', en: 'The wholesaler agrees to ship first and settle at the end of the month.' },
      [{ id: 'e1', template: 'tpl.purchase_inventory_credit', params: { amount: 2800000 } }],
      ['tm_a3p9y6kc'],
    ),
    step(
      S.sellCredit,
      10,
      { 'zh-TW': '賒銷全部存貨', en: 'Selling all inventory on credit' },
      { 'zh-TW': '補習班把整批貨訂走，約定月底付款。', en: 'A cram school orders the whole batch and agrees to pay at month end.' },
      [{ id: 'e1', template: 'tpl.sell_all_inventory_credit', params: { price: 5600000 } }],
      ['tm_r7x2c9fa', 'tm_v3n8q2ye'],
      [{ ref: 'e1.costOfAllInventory', value: 2800000 }],
    ),
    step(
      S.payPayables,
      11,
      { 'zh-TW': '付清貨款', en: 'Paying the supplier in full' },
      { 'zh-TW': '月底到了，把欠批發商的貨款全部付清。', en: 'At month end the shop pays the wholesaler everything it owes.' },
      [{ id: 'e1', template: 'tpl.pay_all_payables', params: {} }],
      ['tm_a3p9y6kc'],
      [{ ref: 'e1.amount', value: 2800000 }],
    ),
    step(
      S.collect,
      12,
      { 'zh-TW': '收回部分帳款', en: 'Collecting part of the receivable' },
      { 'zh-TW': '補習班先匯來一部分，剩下的說下個月再付。', en: 'The cram school transfers part of the amount and promises the rest next month.' },
      [{ id: 'e1', template: 'tpl.collect_receivables', params: { amount: 3900000 }, pendingRefs: ['T08'] }],
      ['tm_r7x2c9fa'],
    ),
    step(
      S.directors,
      13,
      { 'zh-TW': '付董監事酬勞', en: 'Paying directors' },
      { 'zh-TW': '年中結算後，依章程付給董監事酬勞。', en: 'After the mid-year review, the directors are paid as the articles provide.' },
      [{ id: 'e1', template: 'tpl.pay_directors_remuneration_cash', params: { amount: 210000 } }],
      ['tm_q5srzxb2'],
    ),
    step(
      S.packing,
      14,
      { 'zh-TW': '付包裝運送費', en: 'Paying packing and freight' },
      { 'zh-TW': '整年的紙箱與貨運帳單一次結清。', en: 'The year of cartons and courier bills is settled in one payment.' },
      [{ id: 'e1', template: 'tpl.pay_packing_freight_cash', params: { amount: 380000 } }],
      ['tm_dxr5anv4'],
    ),
    step(
      S.repay,
      15,
      { 'zh-TW': '還款並付息', en: 'Repaying the loan with interest' },
      { 'zh-TW': '借款到期，連本帶利一次還給銀行。', en: 'The loan falls due and is repaid to the bank with interest in one payment.' },
      [{ id: 'e1', template: 'tpl.repay_all_short_term_loans_with_interest', params: { interest: 27000 } }],
      ['tm_s5b8r3hd', 'tm_k6t2e9wr'],
      [{ ref: 'e1.principal', value: 900000 }],
    ),
    step(
      S.count,
      16,
      { 'zh-TW': '年底盤點', en: 'Year-end stocktake' },
      { 'zh-TW': '盤點時發現架上還有一批沒入帳的筆記本。', en: 'The stocktake finds a batch of notebooks on the shelves that was never recorded.' },
      [{ id: 'e1', template: 'tpl.inventory_count', params: { countedAmount: 420000 }, pendingRefs: ['T06'] }],
      ['tm_n7v3k8pq', 'tm_g5c2m8tw'],
      [{ ref: 'e1.overage', value: 420000 }],
    ),
    step(
      S.yearEnd,
      17,
      { 'zh-TW': '年底調整：設備折舊與設立費攤銷', en: 'Year-end adjustments: depreciation and amortisation' },
      {
        'zh-TW': '結帳前，會計提醒要提列電腦的折舊，也要攤銷今年的設立費。',
        en: 'Before closing, the accountant depreciates the computers and amortises this year of start-up costs.',
      },
      [
        { id: 'e1', template: 'tpl.depreciation_straight_line', params: { usefulLifeYears: 4 } },
        { id: 'e2', template: 'tpl.amortise_org_costs', params: { years: 5 }, pendingRefs: ['T04', 'T05', 'T12'] },
      ],
      ['tm_d4p7x2mv', 'tm_a8d5c1pz', 'tm_a2m7z4tf'],
      [
        { ref: 'e1.amount', value: 90000 },
        { ref: 'e2.amount', value: 30000 },
      ],
    ),
    step(
      S.incomeTax,
      18,
      { 'zh-TW': '付所得稅', en: 'Paying income tax' },
      { 'zh-TW': '會計師算好稅額，公司直接以現金繳納。', en: 'The accountant works out the tax and the company pays it in cash.' },
      [{ id: 'e1', template: 'tpl.pay_income_tax_cash', params: { amount: 560000 }, pendingRefs: ['T10'] }],
      ['tm_3qfqnrmm'],
    ),
  ],
};

/** 第 18 步之後的累計結果（04 第 17 節表，手算） */
export const LIME_LEAF_FINAL = {
  cash: 2137000,
  accounts_receivable: 1700000,
  inventory: 420000,
  machinery_equipment: 360000,
  accumulated_depreciation_machinery: 90000,
  deferred_organisation_costs: 120000,
  share_capital: 2400000,
  revenue: 6720000,
  cost_of_goods_sold: 3020000,
  income_tax_expense: 560000,
} as const;
