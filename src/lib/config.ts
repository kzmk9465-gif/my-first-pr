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
  /** デフォルトの入札単位（円） */
  defaultBidIncrement: Number(process.env.DEFAULT_BID_INCREMENT ?? 100),
  /** 管理者として扱うメールアドレス（カンマ区切り） */
  adminEmails: (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
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

export const CERTIFICATE_LABELS: Record<string, string> = {
  original: "原作出証明",
  sales: "販売証明",
  bloodline: "繁殖血統",
};
