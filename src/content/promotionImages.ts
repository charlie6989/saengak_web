/** Campaign-specific artwork; new campaigns retain their own supplied creative. */
const campaignImages: Record<string, string> = {
  WELCOME100: 'promotion-welcome',
  SAVE15: 'promotion-discount',
  FREESHIP: 'promotion-shipping',
  SPECIAL30: 'promotion-member',
};
export function promotionImage(code: string, supplied?: string | null): string | undefined {
  const image = campaignImages[code.toUpperCase()];
  return image ? `/images/lucissi-v5/${image}.webp` : supplied || undefined;
}
