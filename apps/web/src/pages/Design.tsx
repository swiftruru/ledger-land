// 關於系統設計（02 第 1.1 節）：網站作者的設計筆記，公開、雙語、可離線。文字沿用定稿，之後會隨著系統成形慢慢補上。
import { Trans } from '@lingui/react/macro';

export default function Design() {
  return (
    <>
      <h1>
        <Trans id="design.title">關於系統設計</Trans>
      </h1>
      <h2>
        <Trans id="design.why.title">為什麼想做這個</Trans>
      </h2>
      <p>
        <Trans id="design.why.1">
          會計課上到一半，我發現自己最記得的，不是哪個科目該放哪裡，而是老師把一家小公司的故事從頭講到尾：先拿錢成立，買了一台電腦，進了一批貨，賣掉，借錢，再還錢。三張報表就在這些小事裡慢慢長出來。
        </Trans>
      </p>
      <p>
        <Trans id="design.why.2">
          那時候我想，如果可以把這個過程做成一個可以動手玩的東西，讓數字自己跑，讓人看見每一筆交易在報表裡留下的痕跡，也許會計就不會那麼像一堆要背的規則了。
        </Trans>
      </p>
      <p>
        <Trans id="design.why.3">LedgerLand 就是這樣開始的。它不是要取代課程，比較像一本可以翻、可以按的練習簿。</Trans>
      </p>
      <h2>
        <Trans id="design.statements.title">從報表倒著看</Trans>
      </h2>
      <p>
        <Trans id="design.statements.1">
          老師的教法是先看報表，再回頭看交易，而不是先學借貸再學分錄。我喜歡這個順序，因為它跟一般人認識一家公司的方式比較像：先看結果，再問為什麼。
        </Trans>
      </p>
      <p>
        <Trans id="design.statements.2">所以這裡的主線也是這樣。借貸和分錄沒有消失，只是放在後面一點的地方，等你想知道「數字從哪裡來」的時候再打開。</Trans>
      </p>
      <h2>
        <Trans id="design.source.title">數字只有一個來源</Trans>
      </h2>
      <p>
        <Trans id="design.source.1">
          網站裡所有的數字，包括餘額、三張報表、財務比率、題目的答案，都是從同一組分錄算出來的。沒有任何一個數字是另外手寫上去的。
        </Trans>
      </p>
      <p>
        <Trans id="design.source.2">
          這樣做的理由很簡單：如果有一天某個地方算錯了，它只會錯在一個地方，改一次就好。也因為這樣，你在實驗室裡改了一筆金額，後面的每一張表都會跟著變，不會有哪個角落還留著舊的數字。
        </Trans>
      </p>
      <h2>
        <Trans id="design.layout.title">課程的版面，現行的準則</Trans>
      </h2>
      <p>
        <Trans id="design.layout.1">
          課程用的報表格式，有幾個現行準則已經不再使用的名字，像是經常利益、非常損益、遞延資產。我沒有把它們拿掉，因為那是課堂上會看到的樣子。
        </Trans>
      </p>
      <p>
        <Trans id="design.layout.2">
          我做的是把兩邊並排：報表照課程的版面顯示，旁邊標出哪些項目在現行的國際財務報導準則裡沒有，點開可以看到現在的做法是什麼。實驗室裡也可以整套切換成準則的版本，看看同一組交易在兩種規則下，數字差在哪裡。
        </Trans>
      </p>
      <p>
        <Trans id="design.layout.3">我不想替哪一邊選邊，只想把差異放在看得見的地方。</Trans>
      </p>
      <h2>
        <Trans id="design.unsaid.title">老師沒有說的部分</Trans>
      </h2>
      <p>
        <Trans id="design.unsaid.1">
          教材裡有一些地方沒有明說，例如設立費要不要資本化、盤點多出來的存貨要記在哪裡、付利息算哪一種活動。一開始我列了一長串問題，想一條一條問老師。
        </Trans>
      </p>
      <p>
        <Trans id="design.unsaid.2">
          後來覺得這樣太細了，也太打擾。只要做法符合一般公認的會計原則，剩下的就由我判斷，把理由寫下來。老師知道這個專案，會幫忙留意內容；有不一樣的意見，再改就好。每一個這樣的選擇，都做成可以切換的設定，不是寫死的規則。
        </Trans>
      </p>
      <p>
        <Trans id="design.unsaid.3">這一頁後面會慢慢補上那些選擇，以及為什麼。</Trans>
      </p>
      <h2>
        <Trans id="design.questions.title">題目是自己寫的</Trans>
      </h2>
      <p>
        <Trans id="design.questions.1">所有的題目、解說、名詞卡都是重新寫過的，不是把課本的題目換個數字。教材是地圖，不是答案本。</Trans>
      </p>
      <p>
        <Trans id="design.questions.2">
          唯一直接沿用的是故事裡那家公司的情境和金額，因為它和課堂上用的是同一組數字，對照起來最方便。這部分經過老師同意，也在授權說明裡寫清楚了。
        </Trans>
      </p>
      <h2>
        <Trans id="design.play.title">沒有生命值，沒有排行榜</Trans>
      </h2>
      <p>
        <Trans id="design.play.1">闖關區長得像遊戲，但這裡沒有倒數計時、沒有體力、沒有要跟別人比的名次。關卡也不會鎖住你。</Trans>
      </p>
      <p>
        <Trans id="design.play.2">我希望它比較像散步，走錯了可以回頭再走一次，而不是一場要衝過的考試。星星只是記錄你來過哪裡。</Trans>
      </p>
      <h2>
        <Trans id="design.progress.title">進度留在你自己的手上</Trans>
      </h2>
      <p>
        <Trans id="design.progress.1">網站不需要帳號。你的進度存在你自己的手機或電腦裡，想換裝置的時候可以匯出備份，想清掉就清掉。</Trans>
      </p>
      <p>
        <Trans id="design.progress.2">沒有追蹤，沒有 cookie。只有一個不認得你是誰的訪客計數，讓我知道有沒有人來過。</Trans>
      </p>
      <h2>
        <Trans id="design.mobile.title">手機優先，離線也能用</Trans>
      </h2>
      <p>
        <Trans id="design.mobile.1">大多數人會在手機上打開它，可能在捷運上，可能在睡前。所以每一頁都先為小螢幕設計，加到主畫面之後，沒有網路也能繼續用。</Trans>
      </p>
      <h2>
        <Trans id="design.languages.title">兩種語言</Trans>
      </h2>
      <p>
        <Trans id="design.languages.1">
          中文是課堂的語言，英文是準則的語言。報表的每一列、每一個名詞，都同時有兩種寫法，而且是同一份資料，不是兩份各自維護的翻譯。切換語言的時候，你正在做的題目不會消失。
        </Trans>
      </p>
      <h2>
        <Trans id="design.colours.title">顏色</Trans>
      </h2>
      <p>
        <Trans id="design.colours.1">
          淺色是紙的顏色，深色有三種：夜空、莓果、紅酒。沒有特別的理由，只是看久了眼睛舒服一點，而且晚上讀書的時候，想要可以選一個自己喜歡的。
        </Trans>
      </p>
      <h2>
        <Trans id="design.open.title">公開的理由</Trans>
      </h2>
      <p>
        <Trans id="design.open.1">
          程式碼和原創的內容都是公開的。一方面是因為我覺得學習的東西本來就該讓人看見怎麼做出來的；另一方面也是提醒自己，寫下的每一個選擇都要經得起別人翻閱。
        </Trans>
      </p>
      <p>
        <Trans id="design.open.2">如果你發現哪裡不對，或者有更好的說法，歡迎告訴我。這個網站會一直慢慢修。</Trans>
      </p>
      <p className="ll-muted ll-small">
        <Trans id="design.footer">這一頁會跟著系統一起慢慢成形。</Trans>
      </p>
    </>
  );
}
