/** サイト全体の設定。環境変数で上書きできる。 */
export const siteConfig = {
  name: process.env.SITE_NAME ?? "播州めだか",
  auctionName: process.env.AUCTION_NAME ?? "播州オク",
  auctionNameEn: "BANSHU MEDAKA AUCTION",
  tagline: "THE PRIVATE MEDAKA AUCTION",
  baseUrl: process.env.BASE_URL ?? "http://localhost:3000",
  /** 終了間際の入札で延長する秒数（デフォルト5分） */
  autoExtendSeconds: Number(process.env.AUTO_EXTEND_SECONDS ?? 300),
  /** 自動延長が発動する残り時間（秒） */
  autoExtendWindowSeconds: Number(process.env.AUTO_EXTEND_WINDOW_SECONDS ?? 300),
  /** 最短の延長秒数（サドンデス時はここまで縮む） */
  minExtendSeconds: Number(process.env.MIN_EXTEND_SECONDS ?? 60),
  /** 新規出品のサドンデス初期値 */
  suddenDeathDefault: process.env.SUDDEN_DEATH_DEFAULT !== "false",
  /** 会員承認制（false にすると登録だけで入札可能） */
  requireApproval: process.env.REQUIRE_APPROVAL !== "false",
  /** 手数料プラン（名前:率%）。例 FEE_PLANS="self:10,support:30,full:50" */
  feePlans: (process.env.FEE_PLANS ?? "self:10,support:30,full:50")
    .split(",")
    .map((s) => s.split(":"))
    .filter((p) => p.length === 2)
    .map(([key, rate]) => ({ key: key.trim(), rate: Number(rate) })),
  /** 会員ランク（累計落札額の下限:名前）。例 RANKS="0:見習い,10000:常連,50000:上客,200000:名人" */
  ranks: (process.env.RANKS ?? "0:見習い,10000:常連,50000:上客,200000:名人")
    .split(",")
    .map((s) => s.split(":"))
    .filter((p) => p.length === 2)
    .map(([min, name], i) => ({ level: i, min: Number(min), name: name.trim() }))
    .sort((a, b) => a.min - b.min),
  /** 二次販売証明の発行料（円）。0 で無料 */
  secondaryCertFee: Number(process.env.SECONDARY_CERT_FEE ?? 0),
  /** 画像アップロードの保存先 */
  uploadDir: process.env.UPLOAD_DIR ?? "",
  /** デフォルトの入札単位（円） */
  defaultBidIncrement: Number(process.env.DEFAULT_BID_INCREMENT ?? 100),
  /** 管理者として扱うメールアドレス（カンマ区切り） */
  adminEmails: (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  /** オンライン決済（Stripe Checkout）。鍵が無ければモード自動切替でモック決済 */
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
    currency: process.env.PAYMENT_CURRENCY ?? "jpy",
  },
  /** 落札後の支払い案内（銀行振込を想定） */
  payment: {
    method: process.env.PAYMENT_METHOD ?? "銀行振込",
    bankInfo: process.env.PAYMENT_BANK_INFO ?? "（振込先は落札後にメールでご案内します）",
    dueDays: Number(process.env.PAYMENT_DUE_DAYS ?? 3),
  },
  /** 特定商取引法に基づく表記（環境変数で設定） */
  legal: {
    businessName: process.env.LEGAL_BUSINESS_NAME ?? "播州めだか",
    representative: process.env.LEGAL_REPRESENTATIVE ?? "（代表者名を設定してください）",
    address: process.env.LEGAL_ADDRESS ?? "（所在地を設定してください）",
    phone: process.env.LEGAL_PHONE ?? "（電話番号を設定してください）",
    email: process.env.LEGAL_EMAIL ?? "（メールアドレスを設定してください）",
    shippingFee: process.env.LEGAL_SHIPPING_FEE ?? "落札価格に加え、配送地域別の送料を実費でご負担いただきます。",
  },
  line: {
    addFriendUrl: process.env.LINE_ADD_FRIEND_URL ?? "",
  },
};

export const FEE_PLAN_LABELS: Record<string, string> = {
  self: "セルフプラン（出品・撮影・発送を自分で）",
  support: "サポートプラン（撮影・説明文をお店が支援）",
  full: "フルプラン（魚を預けて販売はお店に全部おまかせ）",
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  awaiting_payment: "お支払い待ち",
  paid: "入金確認済み",
  shipped: "発送済み",
  completed: "お受け取り完了",
  cancelled: "取消",
};

export const CERTIFICATE_LABELS: Record<string, string> = {
  original: "原作出証明",
  sales: "販売証明",
  bloodline: "繁殖血統",
};

// 本番で初期値のままだと認証コードのハッシュが推測可能になるため警告する（起動時に一度）
if (process.env.NODE_ENV === "production") {
  if (!process.env.OTP_SALT) {
    console.warn("[banshu] 警告: OTP_SALT が未設定です。本番では長いランダム文字列を必ず設定してください。");
  }
  if (!process.env.BASE_URL) {
    console.warn("[banshu] 警告: BASE_URL が未設定です。決済・LINEのリダイレクトが正しく動かない場合があります。");
  }
}
