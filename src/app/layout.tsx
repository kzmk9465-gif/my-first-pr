import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { siteConfig } from "@/lib/config";
import { getCurrentUser } from "@/lib/auth";
import { getSellerForUser } from "@/lib/sellers";
import { activeNews, headline, hotResults } from "@/lib/news";
import { ticker } from "@/lib/auctions";
import Ticker from "@/components/Ticker";
import Kawaraban from "@/components/Kawaraban";
import Broadcast from "@/components/Broadcast";
import Seal from "@/components/Seal";

export const metadata: Metadata = {
  title: { default: `${siteConfig.auctionName} | ${siteConfig.name}`, template: `%s | ${siteConfig.name}` },
  description: `${siteConfig.name}のメダカオークション「${siteConfig.auctionName}」。会員制のプライベートオークションです。`,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: siteConfig.auctionName, statusBarStyle: "black-translucent" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#080C14" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const isSeller = user ? !!getSellerForUser(user.id) : false;
  const alerts = activeNews("alert", 3);
  const broadcast = activeNews("broadcast", 1)[0];
  const news = activeNews("news", 10).map((n) => ({ id: n.id, title: n.title, body: n.body, image_url: n.image_url, created_at: n.created_at }));
  const results = hotResults(5).map((r) => ({ id: r.id, title: r.title, current_price: r.current_price, headline: headline(r) }));
  const tick = ticker().map((t) => ({ id: t.id, listing_id: t.listing_id, title: t.title, label: t.label, amount: t.amount, created_at: t.created_at }));
  return (
    <html lang="ja">
      <body className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-40 backdrop-blur-md bg-background/85 border-b border-accent/25 shadow-[0_8px_24px_-20px_rgba(0,0,0,0.9)]">
          <nav className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between gap-4">
            <Link href="/oripa" className="flex items-center gap-2.5 group">
              <Seal size={34} className="drop-shadow-[0_0_10px_rgba(125,249,255,0.35)] transition-transform group-hover:scale-105" />
              <span className="leading-none">
                <span className="block font-black tracking-[0.22em] text-accent-2 text-lg">{siteConfig.auctionName}</span>
                <span className="block text-[9px] text-muted tracking-[0.34em] mt-0.5 hidden sm:block">{siteConfig.auctionNameEn}</span>
              </span>
            </Link>
            <div className="flex items-center gap-3 text-sm">
              <Link href="/oripa" className="hover:text-accent-2 font-bold">播州くじ</Link>
              <Link href="/auctions" className="hover:text-accent-2">競市</Link>
              <Link href="/zukan" className="hover:text-accent-2 hidden sm:inline">図鑑</Link>
              <Link href="/contests" className="hover:text-accent-2 hidden sm:inline">品評会</Link>
              <Link href="/guide" className="hover:text-accent-2 hidden sm:inline">説明</Link>
              {user ? (
                <>
                  {isSeller && <Link href="/sell/dashboard" className="hover:text-accent-2 hidden sm:inline">出品</Link>}
                  {user.role === "admin" && <Link href="/admin" className="hover:text-accent-2 hidden sm:inline">管理</Link>}
                  <Link href="/mypage" className="btn btn-outline !py-1 !px-3">
                    マイページ{user.status === "pending" && user.role !== "admin" && <span className="badge badge-hot ml-1">承認待ち</span>}
                  </Link>
                </>
              ) : (
                <Link href="/login" className="btn !py-1 !px-3">ログイン</Link>
              )}
            </div>
          </nav>
        </header>
        {alerts.length > 0 && (
          <div className="bg-accent text-[#042430] text-sm">
            {alerts.map((a) => (
              <div key={a.id} className="mx-auto max-w-5xl px-4 py-1.5 flex items-center gap-3">
                <span className="font-black">📣</span>
                <span className="font-bold">{a.title}</span>
                {a.body && <span className="text-xs opacity-80 truncate">{a.body}</span>}
                {a.image_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={a.image_url} alt="" className="h-6 rounded ml-auto" />}
              </div>
            ))}
          </div>
        )}
        {broadcast && <Broadcast id={broadcast.id} text={broadcast.title} />}
        <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-6 pb-12">{children}</main>
        <Kawaraban news={news} results={results} />
        <Ticker initial={tick} />
        <footer className="border-t border-accent/20 text-xs text-muted mt-4">
          <div className="hairline" />
          <div className="mx-auto max-w-5xl px-4 py-7 flex flex-wrap gap-x-5 gap-y-3 items-center justify-between">
            <div className="flex items-center gap-2 mr-2 opacity-80"><Seal size={22} /><span className="tracking-[0.2em] text-accent-2 font-bold">{siteConfig.auctionName}</span></div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <Link href="/guide" className="hover:text-accent-2">使い方</Link>
              <Link href="/zukan" className="hover:text-accent-2">メダカ図鑑</Link>
              <Link href="/contests" className="hover:text-accent-2">品評会</Link>
              <Link href="/legal/tokushoho" className="hover:text-accent-2">特定商取引法に基づく表記</Link>
              <Link href="/legal/terms" className="hover:text-accent-2">利用規約</Link>
              <Link href="/legal/privacy" className="hover:text-accent-2">プライバシーポリシー</Link>
            </div>
            <div>© {new Date().getFullYear()} {siteConfig.name}</div>
          </div>
        </footer>
      </body>
    </html>
  );
}
