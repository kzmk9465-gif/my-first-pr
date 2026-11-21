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
        <p>終了時刻の時点で最高額の方が落札者となり、メールとお知らせでご連絡します。お支払いは{siteConfig.payment.method}で、落札後{siteConfig.payment.dueDays}日以内にお願いします。{siteConfig.payment.bankInfo}</p>
      </section>
      <section>
        <h2 className="font-bold text-accent-2 mb-1">4. 発送・生体について</h2>
        <p>{siteConfig.legal.shippingFee} 生体のため、死着保証の条件は各出品の説明欄をご確認ください。</p>
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
        <h2 className="font-bold text-accent-2 mb-1">6. フォロー機能</h2>
        <p>出品者ページの☆を押すと、その出品者が新しく出品したときにお知らせします。</p>
      </section>
    </article>
  );
}
