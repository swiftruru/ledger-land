// 示範作答頁用的原創題目（自編情境與數字，不取自教材）。題目的正式 schema 與內容管線在 M1，這裡只給 M0b 的「作答狀態放在路由外 store」示範頁用。
export const DEMO_LEVEL_ID = 'lv_k7m2q9xd';

export const DEMO_QUESTION = {
  id: 'q_h3t6v9pa',
  prompt: {
    'zh-TW': '阿哲經營一家小咖啡店。下列哪一項屬於咖啡店的資產？',
    en: 'Jay runs a small coffee shop. Which of these is an asset of the shop?',
  },
  correctOptionId: 'o_k2m9',
  options: [
    {
      id: 'o_k2m9',
      text: { 'zh-TW': '店裡那台還在使用的咖啡機', en: 'The coffee machine the shop still uses' },
      feedback: {
        'zh-TW': '咖啡機會在未來好幾年持續幫店裡做出咖啡、帶來收入，屬於資產。',
        en: 'The machine will keep helping the shop make and sell coffee for years, so it is an asset.',
      },
    },
    {
      id: 'o_p7x3',
      text: { 'zh-TW': '向朋友借來、還沒還的 {{money:vars.loan}}', en: 'The {{money:vars.loan}} borrowed from a friend and not yet repaid' },
      feedback: {
        'zh-TW': '借來的錢之後要還，「還沒還的借款」是負債。拿到的現金才是資產。',
        en: 'Money that has to be paid back is a liability. The cash received is the asset, not the loan.',
      },
    },
    {
      id: 'o_w4n8',
      text: { 'zh-TW': '這個月已經付掉的水電費 {{money:vars.utilities}}', en: 'The {{money:vars.utilities}} utility bill already paid this month' },
      feedback: {
        'zh-TW': '已經付掉的水電費是這個月的費用，用掉了就不會再帶來好處，不是資產。',
        en: 'A utility bill already paid is an expense of this month. It brings no further benefit, so it is not an asset.',
      },
    },
  ],
  vars: { loan: 30000, utilities: 2400 },
} as const;
