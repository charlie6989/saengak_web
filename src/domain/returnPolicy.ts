/**
 * 店主 2026-11-07 決定：只有密封的私密護理品適用「拆除衛生密封後不適用 7 日解除權」，內著不列入。
 * 新增這類商品時，品名要符合下列字詞，商品頁與購物車才會顯示事前告知。
 */
const SEALED_CARE_PRODUCT = /濕巾|凝膠|慕斯|噴霧|修護組|舒緩組|養膚組/;

export const SEALED_CARE_NOTICE =
  '此商品為密封的個人衛生用品。拆除衛生密封後不適用 7 日解除權；只拆開運送外箱不算拆封，商品有瑕疵仍可依法主張權利。';

export const SEALED_CARE_CART_NOTICE =
  '購物車內有密封的個人衛生用品。拆除衛生密封後不適用 7 日解除權；只拆開運送外箱不算拆封，商品有瑕疵仍可依法主張權利。';

export function isSealedCareProduct(name: string | null | undefined): boolean {
  return SEALED_CARE_PRODUCT.test(name ?? '');
}
