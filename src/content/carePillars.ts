/**
 * LUCISSI CARE 照護入口：導覽、分類頁首、首頁入口與商品歸類的單一來源。
 *
 * 2026-10-17 依市場與品牌評估收斂為「貼身照護」：私密保養、舒適內搭兩個核心面向，
 * 加上跨分類的「生理期照護」情境入口。身體保養商品暫併入私密保養（除毛與修整），
 * 運動內衣併入舒適內搭（運動時穿著）；肌膚保養與輕盈運動不再出現在導覽。
 *
 * 商品歸類以程式判斷（關鍵字優先，再看 Shopify productType），不需要先改 Shopify 後台。
 * 舊分類網址（私密護理、貼身穿著、舒適穿著、身體保養、肌膚保養、輕盈運動）仍可使用。
 * 文案依商品宣稱原則撰寫：不寫療效、專利、認證或無法佐證的形容詞。
 */

export type CarePillarId = 'intimate' | 'comfort' | 'period';

export interface CarePillar {
  id: CarePillarId;
  /** 導覽與分類網址使用的名稱（`/search?category=<name>`）。 */
  name: string;
  eyebrow: string;
  title: string;
  description: string;
  /** 首頁入口圖卡的一句話。 */
  teaser: string;
  heroImage: string;
  heroAlt: string;
  /** 首頁入口圖卡（直式）使用的圖片。 */
  cardImage: string;
  cardAlt: string;
  /** 頁內篩選的子分類。 */
  subcategories: string[];
  /** 商品不足時，用來挑選 LUCISSI Talk 文章的標籤。 */
  articleTags: string[];
}

export const ENDORSEMENT = 'LUCISSI 的日常照護系列';
export const LUCISSI_URL = 'https://lucissi.com';
/** 品牌主張：貼近身體的日常照護。 */
export const CARE_SCOPE = '私密保養、舒適內搭，與生理期的每一天';

export const CARE_PILLARS: CarePillar[] = [
  {
    id: 'intimate',
    name: '私密保養',
    eyebrow: 'INTIMATE CARE',
    title: '私密保養，從溫和開始',
    description: '清潔、舒緩、修護與除毛修整，依照自己的節奏，為私密日常多一點舒適與安心。',
    teaser: '清潔、舒緩、修護與除毛',
    heroImage: '/images/lucissi-v5/catalog-care.webp',
    heroAlt: '透光玫瑰玻璃前的 Saengak 潔淨慕斯與修護噴霧',
    cardImage: '/images/lucissi-v5/home-solution-portrait.webp',
    cardAlt: '手持 Saengak 修護噴霧的日常護理情境',
    subcategories: ['每日清潔', '女性護理', '深層修護', '除毛與修整'],
    articleTags: ['私密護理', '健康知識'],
  },
  {
    id: 'comfort',
    name: '舒適內搭',
    eyebrow: 'EVERYDAY COMFORT',
    title: '貼身的，更要舒服',
    description: '無痕、純棉、生理期與運動時的內搭，每天貼近肌膚的選擇，回到自己的舒適感受。',
    teaser: '無痕、純棉、生理期與運動時的內搭',
    heroImage: '/images/lucissi-v5/catalog-comfort.webp',
    heroAlt: '以雙手確認棉質內著腰帶的柔軟度',
    cardImage: '/images/lucissi-v5/home-wear.webp',
    cardAlt: '棉質內著自然垂放於柔軟座凳',
    subcategories: ['無痕內褲', '純棉內褲', '生理褲', '運動時穿著', '內搭配件'],
    articleTags: ['選購指南', '生活美學'],
  },
  {
    id: 'period',
    name: '生理期照護',
    eyebrow: 'PERIOD CARE',
    title: '生理期，也可以好好過',
    description: '生理褲、清潔與舒緩，把生理期需要的放在一起，少一點擔心，多一點自在。',
    teaser: '生理褲、清潔與舒緩一次備齊',
    heroImage: '/images/lucissi-v5/catalog-feminine.webp',
    heroAlt: '梅紫收納包中的隨身護理噴霧與濕巾',
    cardImage: '/images/lucissi-v5/social-period-square.webp',
    cardAlt: '沙發上的針織熱水袋與柔軟毯子',
    subcategories: [],
    articleTags: ['健康知識', '私密護理'],
  },
];

/** 子分類說明（取代先前含「專利」「沙龍級」「頂級」等未佐證字句的文案）。 */
export const SUBCATEGORY_DESCRIPTIONS: Record<string, string> = {
  每日清潔: '溫和潔淨，作為每天私密保養的第一步。',
  女性護理: '需要多一點呵護的日子，選擇溫和的舒緩與保濕。',
  深層修護: '生理期前後或換季時，給私密肌膚多一層保養。',
  益生菌私密舒緩凝膠: '小管裝的日常舒緩保養，方便隨身。',
};

/**
 * 已退出導覽的舊分類名稱，對應到目前的入口與預選子分類。
 * 空字串的 category 代表回到全部商品。
 */
const LEGACY_CATEGORY_LINKS: Record<string, { category: string; subcategory: string }> = {
  私密護理: { category: '私密保養', subcategory: '' },
  貼身穿著: { category: '舒適內搭', subcategory: '' },
  舒適穿著: { category: '舒適內搭', subcategory: '' },
  身體保養: { category: '私密保養', subcategory: '除毛與修整' },
  輕盈運動: { category: '舒適內搭', subcategory: '運動時穿著' },
  肌膚保養: { category: '', subcategory: '' },
};

export function getCarePillar(id: CarePillarId): CarePillar {
  const pillar = CARE_PILLARS.find((item) => item.id === id);
  if (!pillar) throw new Error(`Unknown care pillar: ${id}`);
  return pillar;
}

/** 把分類網址參數解析成目前的入口名稱與預選子分類；其他值原樣回傳。 */
export function resolveCategoryLink(name: string): { category: string; subcategory: string } {
  const value = (name || '').trim();
  return LEGACY_CATEGORY_LINKS[value] ?? { category: value, subcategory: '' };
}

/** 把舊分類網址參數轉成目前的入口名稱；其他值原樣回傳。 */
export function resolveCategoryName(name: string): string {
  return resolveCategoryLink(name).category;
}

/** 由分類名稱（含舊名）找出入口；不是入口名稱時回傳 undefined。 */
export function findCarePillarByName(name: string | null | undefined): CarePillar | undefined {
  const value = resolveCategoryName(name || '');
  if (!value) return undefined;
  return CARE_PILLARS.find((pillar) => pillar.name === value);
}

export interface CareClassifiable {
  name?: string | null;
  title?: string | null;
  productType?: string | null;
  tags?: string[] | null;
}

type CoreCareId = Exclude<CarePillarId, 'period'>;

const MOVEMENT_KEYWORDS = ['運動內衣', '運動', '瑜伽', '伸展'];
const BODY_KEYWORDS = ['除毛', '刮毛', '身體乳', '身體保濕', '去角質', '按摩油', '美體'];
const COMFORT_ACCESSORY_KEYWORDS = ['護衣袋', '洗衣袋', '清洗袋'];
const COMFORT_KEYWORDS = ['內褲', '內著', '生理褲', '安全褲', '防漏褲', '平口褲', '三角褲', '丁字褲'];
const INTIMATE_TYPES = ['每日清潔', '女性護理', '深層修護'];
const INTIMATE_TAGS = ['私密護理', '私密保養', '女性護理'];
const COMFORT_TYPES = ['舒適穿著', '舒適內搭'];
const PERIOD_KEYWORDS = ['生理', '防漏', '月經', '經期'];
const PERIOD_CARE_KEYWORDS = ['濕巾', '舒緩凝膠'];

/** Shopify productType 直接設為面向名稱時，以後台的明確設定為準（含已退出導覽的舊名）。 */
const PILLAR_PRODUCT_TYPES: Record<string, CoreCareId> = {
  私密保養: 'intimate',
  身體保養: 'intimate',
  舒適內搭: 'comfort',
  輕盈運動: 'comfort',
};

/**
 * 判斷商品屬於哪個核心面向（私密保養或舒適內搭）。productType 等於面向名稱時直接採用；
 * 其餘以關鍵字優先於舊 productType：除毛刀歸私密保養，護衣袋與運動內衣歸舒適內搭。
 * 臉部保養等不在範圍內的商品回傳 undefined，只出現在全部商品。
 */
export function classifyCarePillar(product: CareClassifiable): CoreCareId | undefined {
  const name = `${product.name || ''} ${product.title || ''}`;
  const type = (product.productType || '').trim();
  const tags = Array.isArray(product.tags) ? product.tags : [];
  const text = [name, type, ...tags].join(' ');
  const nameAndType = `${name} ${type}`;
  const has = (keywords: string[]) => keywords.some((keyword) => text.includes(keyword));
  // 運動與身體保養只看品名與 productType：內褲常帶「運動時穿著」之類的使用情境標籤
  const named = (keywords: string[]) => keywords.some((keyword) => nameAndType.includes(keyword));

  if (PILLAR_PRODUCT_TYPES[type]) return PILLAR_PRODUCT_TYPES[type];
  if (named(MOVEMENT_KEYWORDS)) return 'comfort';
  if (named(BODY_KEYWORDS)) return 'intimate';
  if (has(COMFORT_ACCESSORY_KEYWORDS) || COMFORT_TYPES.includes(type) || has(COMFORT_KEYWORDS)) return 'comfort';
  // 私密保養需有明確訊號：舊 productType、品名含「私密」或私密護理標籤；一般凝膠不算
  if (INTIMATE_TYPES.includes(type) || name.includes('私密') || tags.some((tag) => INTIMATE_TAGS.includes(tag))) return 'intimate';
  return undefined;
}

/**
 * 生理期照護是跨分類的情境入口：生理褲、私密濕巾與舒緩凝膠、內搭清洗配件，
 * 或 Shopify 標籤／productType 明確標示生理期的商品。
 */
export function isPeriodCareProduct(product: CareClassifiable): boolean {
  const name = `${product.name || ''} ${product.title || ''}`;
  const type = (product.productType || '').trim();
  const tags = Array.isArray(product.tags) ? product.tags : [];
  if (type === '生理期照護' || tags.some((tag) => tag === '生理期' || tag === '生理期照護')) return true;
  if (PERIOD_KEYWORDS.some((keyword) => name.includes(keyword))) return true;
  const core = classifyCarePillar(product);
  if (core === 'intimate' && PERIOD_CARE_KEYWORDS.some((keyword) => name.includes(keyword))) return true;
  return core === 'comfort' && COMFORT_ACCESSORY_KEYWORDS.some((keyword) => name.includes(keyword));
}

/** 商品是否出現在某個入口。 */
export function belongsToCarePillar(product: CareClassifiable, id: CarePillarId): boolean {
  return id === 'period' ? isPeriodCareProduct(product) : classifyCarePillar(product) === id;
}

/** 子分類比對（私密保養的舊 productType 子分類由搜尋頁直接比對 productType）。 */
export function matchesCareSubcategory(product: CareClassifiable, subcategory: string): boolean {
  const name = `${product.name || ''} ${product.title || ''}`;
  switch (subcategory) {
    case '無痕內褲':
      return name.includes('無痕');
    case '純棉內褲':
      return name.includes('純棉') && !name.includes('生理');
    case '生理褲':
      return name.includes('生理') || name.includes('防漏');
    case '內搭配件':
      return COMFORT_ACCESSORY_KEYWORDS.some((keyword) => name.includes(keyword));
    case '運動時穿著':
      return MOVEMENT_KEYWORDS.some((keyword) => name.includes(keyword));
    case '除毛與修整':
      return BODY_KEYWORDS.some((keyword) => name.includes(keyword));
    default:
      return false;
  }
}

/** 私密保養沿用 Shopify productType 的子分類。 */
export const PRODUCT_TYPE_SUBCATEGORIES = ['每日清潔', '女性護理', '深層修護'];
