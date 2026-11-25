/**
 * 播州くじの送料(1回の注文につき・税込)。口数が FREE_SHIPPING_COUNT 以上の注文は無料。
 * 注文時に口の代金と合算し、1回の振込で済ませる(発送依頼時に2回目の支払いを求めない)。
 * DBに依存しないので、クライアント部品(OripaCard)からも読める。
 */
export const SHIPPING_YEN = Number(process.env.NEXT_PUBLIC_ORIPA_SHIPPING_YEN ?? 1500);
export const FREE_SHIPPING_COUNT = Number(process.env.NEXT_PUBLIC_ORIPA_FREE_SHIPPING_COUNT ?? 4);
export function shippingFor(count: number): number {
  return count >= FREE_SHIPPING_COUNT ? 0 : SHIPPING_YEN;
}
