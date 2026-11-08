// 公式條目的前五段（公式卡、各項數值的意思、計算範例、怎麼看、講義出處）：條目頁（pages/Formula.tsx）與苦練頁的公式面板（FormulaSheet.tsx）共用，
// 兩邊的字串與 data-testid 相同；面板裡標題降一級（h3）。資料是完整內容檔（FormulaSnapshot）。字串在第二層 catalog（pages）。
import { Trans, useLingui } from '@lingui/react/macro';
import { formatNumber, localePath } from '@ledgerland/i18n';
import { Card, TermPill } from '@ledgerland/web-ui';
import type { FormulaSnapshot } from '../../lib/content.ts';
import { useLocale } from '../../lib/useLocale.ts';
import { plainParagraphs } from '../term-page/term-text.ts';

export function FormulaSections({ formula, headingLevel = 2 }: { formula: FormulaSnapshot; headingLevel?: 2 | 3 }) {
  const { t } = useLingui();
  const locale = useLocale();
  const H = headingLevel === 3 ? 'h3' : 'h2';
  const n = (x: number) => formatNumber(x, locale);
  const versionName = (v: FormulaSnapshot['versions'][number]) => {
    const code = v.deck?.code ?? '';
    return v.deck
      ? t({ id: 'formula.version.deck', message: `講義 ${code} 的寫法`, comment: '公式卡裡講義版本的小標；code 是講義編號（例如 0-2）' })
      : v.version === 'excel'
        ? t({ id: 'formula.version.excel', message: '課程 Excel 版', comment: '公式卡裡課程 Excel 模板的寫法的小標' })
        : t({ id: 'formula.version.dupont', message: '杜邦分解', comment: '公式卡裡杜邦分解式的小標' });
  };
  const pageList = (slides: readonly number[]) => slides.map((s) => n(s)).join(locale === 'en' ? ', ' : '、');
  return (
    <>
      <Card as="section" className="ll-fx-card ll-fx-card--formula" data-testid="formula-main">
        <H className="ll-term-section__title">
          <Trans id="formula.section.formula" comment="公式條目頁：公式卡的標題">
            公式
          </Trans>
        </H>
        <p className="ll-num ll-fx-formula" data-testid="formula-line">
          <span className="ll-fx-formula__name">{formula.label}</span>
          <span className="ll-fx-formula__eq" aria-hidden="true">
            ＝
          </span>
          <span className="ll-sr-only">{t({ id: 'formula.equals', message: '等於', comment: '公式一行裡等號的讀法（給螢幕閱讀器）' })}</span>
          <span className="ll-fx-formula__body">{formula.formula}</span>
        </p>
        {formula.versions.length > 0 && (
          <dl className="ll-fx-versions" data-testid="formula-versions">
            {formula.versions.map((v) => (
              <div key={v.version} className="ll-fx-versions__row">
                <dt>{versionName(v)}</dt>
                <dd>
                  <span className="ll-num">{v.formula}</span>
                  {v.note && <span className="ll-fx-versions__note">{plainParagraphs(v.note, locale).join(' ')}</span>}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Card>
      <Card as="section" className="ll-fx-card" data-testid="formula-components">
        <H className="ll-term-section__title">
          <Trans id="formula.section.components" comment="公式條目頁：各項數值的意思那一段的標題">
            各項數值的意思
          </Trans>
        </H>
        <dl className="ll-fx-parts">
          {formula.components.map((c, i) => (
            <div key={i} className="ll-fx-parts__row">
              <dt>
                {c.term ? (
                  <TermPill href={localePath(locale, `/terms/${c.term}/`)} cellProps={{ 'data-term-id': c.term }}>
                    {c.label}
                  </TermPill>
                ) : (
                  <span className="ll-fx-parts__plain">{c.label}</span>
                )}
              </dt>
              <dd>{plainParagraphs(c.meaning, locale).join(' ')}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card as="section" className="ll-fx-card ll-fx-card--example" data-testid="formula-example">
        <H className="ll-term-section__title">
          <Trans id="formula.section.example" comment="公式條目頁：計算範例那一段的標題">
            計算範例
          </Trans>
        </H>
        <div className="ll-fx-example ll-num">
          {plainParagraphs(formula.example, locale).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </Card>
      <Card as="section" className="ll-fx-card" data-testid="formula-reading">
        <H className="ll-term-section__title">
          <Trans id="formula.section.reading" comment="公式條目頁：怎麼看那一段的標題（高低代表什麼、要和誰比）">
            怎麼看
          </Trans>
        </H>
        {plainParagraphs(formula.reading, locale).map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </Card>
      {formula.sources.length > 0 && (
        <Card as="section" className="ll-fx-card" data-testid="formula-sources">
          <H className="ll-term-section__title">
            <Trans id="formula.section.sources" comment="公式條目頁：講義出處那一段的標題（講義與頁碼）">
              講義出處
            </Trans>
          </H>
          <ul className="ll-fx-sources">
            {formula.sources.map((s) => {
              const code = s.code;
              const title = s.title;
              const pages = pageList(s.slides);
              return (
                <li key={s.id} lang="zh-TW">
                  {t({
                    id: 'formula.source.item',
                    message: `講義 ${code}「${title}」第 ${pages} 頁`,
                    comment: '講義出處的一列；code 是講義編號、title 是講義名稱、pages 是已格式化、用頓號隔開的頁碼',
                  })}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
