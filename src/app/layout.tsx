import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { siteConfig } from "@/lib/config";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: { default: `${siteConfig.auctionName} | ${siteConfig.name}`, template: `%s | ${siteConfig.name}` },
  description: `${siteConfig.name}のメダカオークション「${siteConfig.auctionName}」。会員制のプライベートオークションです。`,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: siteConfig.auctionName, statusBarStyle: "black-translucent" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#0b1020" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="ja">
      <body className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-40 backdrop-blur bg-background/80 border-b border-accent/20">
          <nav className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between gap-4">
            <Link href="/auctions" className="font-black tracking-widest text-accent-2">
              {siteConfig.auctionName}
              <span className="ml-2 text-[10px] text-muted tracking-[0.3em] hidden sm:inline">{siteConfig.auctionNameEn}</span>
            </Link>
            <div className="flex items-center gap-3 text-sm">
              <Link href="/auctions" className="hover:text-accent-2">会場</Link>
              <Link href="/guide" className="hover:text-accent-2 hidden sm:inline">説明</Link>
              {user ? (
                <>
                  {user.role === "admin" && <Link href="/admin" className="hover:text-accent-2">管理</Link>}
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
        <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-6">{children}</main>
        <footer className="border-t border-accent/20 text-xs text-muted">
          <div className="mx-auto max-w-5xl px-4 py-6 flex flex-wrap gap-x-4 gap-y-2 items-center justify-between">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <Link href="/guide" className="hover:text-accent-2">オークション説明</Link>
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
