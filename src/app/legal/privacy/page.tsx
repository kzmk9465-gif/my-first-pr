import type { Metadata } from "next";
import { siteConfig } from "@/lib/config";

export const metadata: Metadata = { title: "プライバシーポリシー" };

export default function PrivacyPage() {
  return (
    <article className="max-w-2xl mx-auto card p-6 space-y-4 text-sm leading-relaxed">
      <h1 className="text-2xl font-black text-accent-2">プライバシーポリシー</h1>
      <p>{siteConfig.name}（以下「当方」）は、「{siteConfig.auctionName}」の運営にあたり、会員の個人情報を以下のとおり取り扱います。</p>
      <h2 className="font-bold text-accent-2">1. 取得する情報</h2>
      <p>メールアドレス、表示名、発送先（氏名・住所・電話番号）、LINE連携用の識別子、入札・落札の履歴、アクセスログ。</p>
      <h2 className="font-bold text-accent-2">2. 利用目的</h2>
      <ul className="list-disc pl-5">
        <li>ログイン認証および本人確認</li>
        <li>入札・落札に関する通知、落札品の発送、代金の請求</li>
        <li>不正入札の防止、サービスの改善</li>
      </ul>
      <h2 className="font-bold text-accent-2">3. 第三者提供</h2>
      <p>法令に基づく場合、または落札品の配送のために配送業者へ提供する場合を除き、本人の同意なく第三者に提供しません。</p>
      <h2 className="font-bold text-accent-2">4. 外部サービス</h2>
      <p>通知のためにLINE株式会社のMessaging API、メール配信サービスを利用します。各サービスの取扱いは各社のポリシーに従います。</p>
      <h2 className="font-bold text-accent-2">5. 安全管理</h2>
      <p>認証はワンタイムコードで行い、パスワードは保持しません。認証コードはハッシュ化して保存し、一定時間で失効します。</p>
      <h2 className="font-bold text-accent-2">6. 開示・削除</h2>
      <p>会員は自身の情報の開示・訂正・削除を {siteConfig.legal.email} まで請求できます。</p>
    </article>
  );
}
