import type { Metadata } from "next";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = { title: "オークション説明" };

export default function GuidePage() {
  const m = Math.round(siteConfig.autoExtendWindowSeconds / 60);
  const e = Math.round(siteConfig.autoExtendSeconds / 60);
  return (
    <article className="max-w-2xl mx-auto card p-6 space-y-5 text-sm leading-relaxed">
      <h1 className="text-2xl font-black text-accent-2">{siteConfig.auctionName} オークション説明</h1>
      <section>
        <h2 className="font-bold text-accent-2 mb-1">1. 会員登録・ログイン</h2>
        <p>メールアドレスを入力すると6桁の認証コードが届きます。コードを入力するだけでログインできます。パスワードはありません。</p>
        <p className="mt-1">初回ログイン後に氏名・屋号・SNS・発送先を登録してください。{siteConfig.requireApproval ? "お店が内容を確認して承認すると入札できるようになります（承認までの間も閲覧・お気に入り・フォローは利用できます）。" : "登録が済めばすぐに入札できます。"}</p>
      </section>
      <section>
        <h2 className="font-bold text-accent-2 mb-1">2. 入札</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>上限額方式</b>です。入力する金額は「ここまでなら出せる」上限で、実際の価格は他の方の入札状況で決まり、上限を超えることはありません。</li>
          <li>最初の入札は開始価格から、以降は現在価格＋入札単位以上で入札できます。</li>
          <li>他の方の上限に届かなかった入札はその場で競り負けとなり、価格があなたの上限まで上がります。競り負けはマイページの「競り負け履歴」で確認できます。</li>
          <li>入札前に確認画面が出ます。確定後の取り消しはできません。</li>
          <li>終了{m}分以内に入札があった場合、終了時刻が延長されます（基本{e}分。サドンデス設定の出品では延長が回数ごとに短くなり、最短{Math.round(siteConfig.minExtendSeconds / 60)}分です）。</li>
          <li>高値更新されると、お知らせ（LINE連携済みならLINE）で通知します。</li>
        </ul>
      </section>
      <section>
        <h2 className="font-bold text-accent-2 mb-1">3. 落札とお支払い</h2>
        <p>終了時刻の時点で最高額の方が落札者となり、メールとお知らせでご連絡します。即決価格つきの出品は、即決ボタンからその場で落札できます。</p>
        <p className="mt-1">落札後はマイページの「わたしの取引のいま」で、お支払い→入金の確認→発送→お受け取りの進み具合を確認できます。お支払い合計は落札額＋送料（常温便またはクール便）で、お支払い方法は出品者ごとの案内に従ってください（原則{siteConfig.payment.method}、落札後{siteConfig.payment.dueDays}日以内）。発送されると配送業者と追跡番号をお知らせします。</p>
      </section>
      <section>
        <h2 className="font-bold text-accent-2 mb-1">4. 発送・生体について</h2>
        <p>{siteConfig.legal.shippingFee} 生体のため、死着保証の条件は各出品の説明欄をご確認ください。</p>
      </section>
      <section>
        <h2 className="font-bold text-accent-2 mb-1">4-2. 落札販売証明書と系図</h2>
        <p>落札した個体には、ご入金の確認後に出品ページから「落札販売証明書」を発行できます（証明番号つき。印刷・保存可）。証明番号から本サイト上で本物かどうかを照合でき、落札した個体から殖やした子を売るときは「二次販売証明」を申請できます（お店が確認して発行。親の証明とのつながりが系図として残ります）。</p>
      </section>
      <section>
        <h2 className="font-bold text-accent-2 mb-1">4-3. 会員ランクと特殊オークション</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>会員ランク</b>：累計落札額に応じて{siteConfig.ranks.map((r) => r.name).join("→")}と上がります。マイページで確認できます。</li>
          <li><b>🌑 闇市</b>：一定以上のランクの方だけが入札できる上級者向けオークションです。</li>
          <li><b>🔒 限定オークション</b>：合言葉を入力した方だけが入札できます。</li>
          <li><b>📦 千両箱</b>：中身が秘密のオークション。画像はシルエットで表示され、落札した方だけが中身を見られます。</li>
        </ul>
      </section>
      <section>
        <h2 className="font-bold text-accent-2 mb-1">4-4. 演出・音楽・声</h2>
        <p>入札が通った時・抜かれた時・一騎打ちの時に、入札画面で短い演出が流れます。終了10分前からは合戦モードになり、残り時間が秒単位で表示されます。画面右上の「音」「演出」の札からそれぞれ入・切できます（はじめは音が出ません）。画面下の速報には最新の入札が流れ、左下の「瓦版」で激戦の品の記事やお知らせが読めます。弾幕コメントは承認済み会員が投稿でき、入札が入ると自動で流れます。</p>
      </section>
      <section>
        <h2 className="font-bold text-accent-2 mb-1">5. 証明マークについて</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>原作出証明</b>：作出者本人、または作出者からの委託による出品です。</li>
          <li><b>販売証明</b>：作出者から正規に購入した個体、またはその血統の出品です。</li>
          <li><b>繁殖血統</b>：作出者の血統を出品者が繁殖させた個体です。</li>
        </ul>
      </section>
      <section>
        <h2 className="font-bold text-accent-2 mb-1">6. フォロー・お気に入り</h2>
        <p>出品者ページの☆を押すと、その出品者が新しく出品したときにお知らせします。出品カードの♡でお気に入りに登録でき、マイページでまとめて見られます。</p>
      </section>
      <section>
        <h2 className="font-bold text-accent-2 mb-1">6-2. 図鑑・品評会・ガチャ</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li><a href="/zukan" className="underline">メダカ図鑑</a>：品種とブリーダーのデータベース。承認済み会員はご自身の作出品種を登録できます（お店の確認後に掲載）。</li>
          <li><a href="/contests" className="underline">品評会</a>：自慢の個体をエントリーし、会員の投票で順位を決めます。</li>
          <li>ガチャ：マイページで毎日ログインボーナスを受け取り、10ポイントで1回挑戦。当選すると景品をお送りします。</li>
          <li>不審な出品を見つけたら、出品ページの「奉行所へ通報する」からお知らせください。</li>
        </ul>
      </section>
      <section>
        <h2 className="font-bold text-accent-2 mb-1">7. 出品したい方へ</h2>
        <p>承認された会員は、お店の出品者登録を受けるとご自身で出品できます。手数料プランは{siteConfig.feePlans.map((p) => `${p.rate}%`).join("／")}から選べ、出品はお店の確認後に公開されます。詳しくは<a href="/sell" className="underline">出品者メニュー</a>をご覧ください。</p>
      </section>
    </article>
  );
}
