import type { Metadata } from "next";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = { title: "利用規約" };

export default function TermsPage() {
  return (
    <article className="max-w-2xl mx-auto card p-6 space-y-4 text-sm leading-relaxed">
      <h1 className="text-2xl font-black text-accent-2">利用規約</h1>
      <p>この利用規約（以下「本規約」）は、{siteConfig.name}（以下「当方」）が運営する「{siteConfig.auctionName}」（以下「本サービス」）の利用条件を定めるものです。会員は本規約に同意のうえ本サービスを利用するものとします。</p>
      <h2 className="font-bold text-accent-2">第1条（会員登録）</h2>
      <p>メールアドレスによる認証を完了した時点で会員登録が成立します。虚偽の情報での登録、他者の名義での登録を禁止します。</p>
      <h2 className="font-bold text-accent-2">第2条（入札と落札）</h2>
      <p>入札は取り消すことができません。終了時刻の時点で最高額の入札者が落札者となり、落札者は当方の案内に従い期限内に代金を支払う義務を負います。期限内に支払いがない場合、当方は落札を取り消し、以後の利用を制限することがあります。</p>
      <h2 className="font-bold text-accent-2">第3条（生体の取扱い）</h2>
      <p>出品物はメダカ等の生体です。個体差、色揚がり、性別、サイズは出品説明に基づくものであり、画像と実物の色合いが異なる場合があります。死着保証の有無と条件は各出品の説明欄に従います。</p>
      <h2 className="font-bold text-accent-2">第4条（禁止事項）</h2>
      <ul className="list-disc pl-5">
        <li>価格操作を目的とした入札、複数アカウントの使用</li>
        <li>落札後の正当な理由のない不払い</li>
        <li>本サービスの運営を妨害する行為、法令または公序良俗に反する行為</li>
      </ul>
      <h2 className="font-bold text-accent-2">第5条（サービスの変更・中断）</h2>
      <p>当方はシステム障害、天災、生体の状態等やむを得ない事情がある場合、オークションを中断・取消することがあります。</p>
      <h2 className="font-bold text-accent-2">第5条の2（播州くじ）</h2>
      <ul className="list-disc pl-5">
        <li>播州くじは、総口数と各賞の本数をあらかじめ定めた箱売りのくじで、全口に賞品が付きます。残り口数と各賞の残本数は画面に表示します。</li>
        <li>くじの口は特定のくじに対して都度購入するものであり、汎用のポイント・前払い残高ではありません。購入後の返金・キャンセルはできません。</li>
        <li>当選品は発送によりお渡しします。当選品を現金、ポイント、他の商品に換えること、および当方による買い取りは一切行いません。送料は1回の注文につき所定の額（画面に表示）で、所定の口数以上の注文は無料です。</li>
        <li>生体の発送は天候と個体の状態を見て行います。気温が低い時期は、保温材を同梱するか、発送を見合わせて適温の時期までお店で預かることがあります。</li>
        <li>当選から30日以内に発送依頼がない場合、当該当選品の受け取りの権利は放棄されたものとみなします。</li>
        <li>18歳未満の方は播州くじを購入できません。会員は登録した生年月日が正確であることを保証するものとします。</li>
        <li>不正な方法での購入・抽選が確認された場合、当方は当選を無効とし、会員資格を停止することがあります。</li>
      </ul>
      <h2 className="font-bold text-accent-2">第6条（免責）</h2>
      <p>当方は、本サービスの利用により会員に生じた損害について、当方の故意または重過失による場合を除き責任を負いません。</p>
      <h2 className="font-bold text-accent-2">第7条（規約の変更）</h2>
      <p>当方は必要に応じて本規約を変更できます。変更後の規約は本サービス上に掲示した時点から効力を生じます。</p>
      <p className="text-xs text-muted">制定日：{new Date().getFullYear()}年</p>
    </article>
  );
}
