/**
 * LUCISSI CARE 五個照護面向：導覽、分類頁首、首頁入口與商品歸類的單一來源。
 *
 * 商品歸類以程式判斷（關鍵字優先，再看 Shopify productType），不需要先改 Shopify 後台。
 * 舊分類網址（私密護理、貼身穿著、舒適穿著）仍會解析到對應面向。
 * 文案依商品宣稱原則撰寫：不寫療效、專利、認證或無法佐證的形容詞。
 */

export type CarePillarId = 'intimate' | 'body' | 'skin' | 'comfort' | 'movement';

export interface CarePillar {
  id: CarePillarId;
  /** 導覽與分類網址使用的名稱（`/search?category=<name>`）。 */
  name: string;
  eyebrow: string;
  title: string;
  description: string;
  /** 首頁面向入口圖卡的一句話。 */
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
  /** 仍可解析到此面向的舊分類名稱。 */
  legacyNames: string[];
}

export const ENDORSEMENT = 'LUCISSI 的日常照護系列';
export const LUCISSI_URL = 'https://lucissi.com';

export const CARE_PILLARS: CarePillar[] = [
  {
    id: 'intimate',
    name: '私密保養',
    eyebrow: 'INTIMATE CARE',
    title: '私密保養，從溫和開始',
    description: '清潔、舒緩與修護，依照自己的節奏，為私密日常多一點舒適與安心。',
    teaser: '清潔、舒緩與修護',
    heroImage: '/images/lucissi-v5/catalog-care.webp',
    heroAlt: '透光玫瑰玻璃前的 Saengak 潔淨慕斯與修護噴霧',
    cardImage: '/images/lucissi-v5/home-solution-portrait.webp',
    cardAlt: '手持 Saengak 修護噴霧的日常護理情境',
    subcategories: ['每日清潔', '女性護理', '深層修護'],
    articleTags: ['私密護理', '健康知識'],
    legacyNames: ['私密護理'],
  },
  {
    id: 'body',
    name: '身體保養',
    eyebrow: 'BODY CARE',
    title: '讓身體，被好好照顧',
    description: '從除毛、保濕到放鬆，把每天的身體保養，變成留給自己的片刻。',
    teaser: '除毛、保濕與放鬆',
    heroImage: '/images/lucissi-v5/home-philosophy.webp',
    heroAlt: '女性在露台門邊留一段安靜的時間給自己',
    cardImage: '/images/lucissi-v5/home-philosophy.webp',
    cardAlt: '女性在露台門邊留一段安靜的時間給自己',
    subcategories: ['除毛', '身體保濕'],
    articleTags: ['日常保養', '生活美學'],
    legacyNames: [],
  },
  {
    id: 'skin',
    name: '肌膚保養',
    eyebrow: 'SKIN CARE',
    title: '肌膚的日常，簡單就好',
    description: '少一點步驟，多一點從容。為每天的肌膚，挑選溫和好用的保養。',
    teaser: '簡單穩當的日常保養',
    heroImage: '/images/lucissi-v5/article-care.webp',
    heroAlt: '在書桌前寫下日常照護筆記',
    cardImage: '/images/lucissi-v5/about-daily-portrait.webp',
    cardAlt: '把隨身保養用品放進托特包的日常片刻',
    subcategories: [],
    articleTags: ['日常保養', '生活美學'],
    legacyNames: [],
  },
  {
    id: 'comfort',
    name: '舒適內搭',
    eyebrow: 'EVERYDAY COMFORT',
    title: '貼身的，更要舒服',
    description: '無痕、純棉與生理期內搭，每天貼近肌膚的選擇，回到自己的舒適感受。',
    teaser: '無痕、純棉與生理期內搭',
    heroImage: '/images/lucissi-v5/catalog-comfort.webp',
    heroAlt: '以雙手確認棉質內著腰帶的柔軟度',
    cardImage: '/images/lucissi-v5/home-wear.webp',
    cardAlt: '棉質內著自然垂放於柔軟座凳',
    subcategories: ['無痕內褲', '純棉內褲', '生理褲', '內搭配件'],
    articleTags: ['選購指南', '生活美學'],
    legacyNames: ['貼身穿著', '舒適穿著'],
  },
  {
    id: 'movement',
    name: '輕盈運動',
    eyebrow: 'GENTLE MOVEMENT',
    title: '動一動，身體會記得',
    description: '不必很激烈。伸展、散步、居家運動，穿得舒服，就更容易開始。',
    teaser: '伸展與居家運動的好穿著',
    heroImage: '/images/lucissi-v5/about-balance-portrait.webp',
    heroAlt: '女性坐在坐墊上安靜伸展',
    cardImage: '/images/lucissi-v5/about-balance-portrait.webp',
    cardAlt: '女性坐在坐墊上安靜伸展',
    subcategories: ['運動內衣'],
    articleTags: ['生活美學', '健康知識'],
    legacyNames: [],
  },
];

/** 子分類說明（取代先前含「專利」「沙龍級」「頂級」等未佐證字句的文案）。 */
export const SUBCATEGORY_DESCRIPTIONS: Record<string, string> = {
  每日清潔: '溫和潔淨，作為每天私密保養的第一步。',
  女性護理: '需要多一點呵護的日子，選擇溫和的舒緩與保濕。',
  深層修護: '生理期前後或換季時，給私密肌膚多一層保養。',
  益生菌私密舒緩凝膠: '小管裝的日常舒緩保養，方便隨身。',
};

export function getCarePillar(id: CarePillarId): CarePillar {
  const pillar = CARE_PILLARS.find((item) => item.id === id);
  if (!pillar) throw new Error(`Unknown care pillar: ${id}`);
  return pillar;
}

/** 由分類名稱（含舊名）找出面向；不是面向名稱時回傳 undefined。 */
export function findCarePillarByName(name: string | null | undefined): CarePillar | undefined {
  const value = (name || '').trim();
  if (!value) return undefined;
  return CARE_PILLARS.find((pillar) => pillar.name === value || pillar.legacyNames.includes(value));
}

/** 把舊分類網址參數轉成目前的面向名稱；其他值原樣回傳。 */
export function resolveCategoryName(name: string): string {
  return findCarePillarByName(name)?.name ?? name;
}

export interface CareClassifiable {
  name?: string | null;
  title?: string | null;
  productType?: string | null;
  tags?: string[] | null;
}

const MOVEMENT_KEYWORDS = ['運動內衣', '運動', '瑜伽', '伸展'];
const BODY_KEYWORDS = ['除毛', '刮毛', '身體乳', '身體保濕', '去角質', '按摩油', '美體'];
const COMFORT_ACCESSORY_KEYWORDS = ['護衣袋', '洗衣袋', '清洗袋'];
const COMFORT_KEYWORDS = ['內褲', '內著', '生理褲', '安全褲', '防漏褲', '平口褲', '三角褲', '丁字褲'];
const SKIN_KEYWORDS = ['面膜', '臉部', '洗面', '化妝水', '面霜', '眼霜'];
const INTIMATE_TYPES = ['每日清潔', '女性護理', '深層修護'];
const INTIMATE_TAGS = ['私密護理', '私密保養', '女性護理'];
const COMFORT_TYPES = ['舒適穿著', '舒適內搭'];

/** Shopify productType 直接設為面向名稱時，以後台的明確設定為準。 */
const PILLAR_PRODUCT_TYPES: Record<string, CarePillarId> = {
  私密保養: 'intimate',
  身體保養: 'body',
  肌膚保養: 'skin',
  舒適內搭: 'comfort',
  輕盈運動: 'movement',
};

/**
 * 判斷商品屬於哪個照護面向。productType 等於面向名稱時直接採用；
 * 其餘以關鍵字優先於舊 productType，例如除毛刀與護衣袋在 Shopify 仍標為「每日清潔」，運動內衣仍標為「舒適穿著」。
 */
export function classifyCarePillar(product: CareClassifiable): CarePillarId | undefined {
  const name = `${product.name || ''} ${product.title || ''}`;
  const type = (product.productType || '').trim();
  const tags = Array.isArray(product.tags) ? product.tags : [];
  const text = [name, type, ...tags].join(' ');
  const nameAndType = `${name} ${type}`;
  const has = (keywords: string[]) => keywords.some((keyword) => text.includes(keyword));
  // 運動與身體保養只看品名與 productType：內褲常帶「運動時穿著」之類的使用情境標籤
  const named = (keywords: string[]) => keywords.some((keyword) => nameAndType.includes(keyword));

  if (PILLAR_PRODUCT_TYPES[type]) return PILLAR_PRODUCT_TYPES[type];
  if (named(MOVEMENT_KEYWORDS)) return 'movement';
  if (named(BODY_KEYWORDS)) return 'body';
  if (has(COMFORT_ACCESSORY_KEYWORDS) || COMFORT_TYPES.includes(type) || has(COMFORT_KEYWORDS)) return 'comfort';
  if (has(SKIN_KEYWORDS)) return 'skin';
  // 私密保養需有明確訊號：舊 productType、品名含「私密」或私密護理標籤；一般凝膠不算
  if (INTIMATE_TYPES.includes(type) || name.includes('私密') || tags.some((tag) => INTIMATE_TAGS.includes(tag))) return 'intimate';
  return undefined;
}

/** 舒適內搭與輕盈運動的子分類比對。 */
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
    case '運動內衣':
      return name.includes('運動');
    case '除毛':
      return name.includes('除毛') || name.includes('刮毛');
    case '身體保濕':
      return ['身體乳', '身體保濕', '按摩油'].some((keyword) => name.includes(keyword));
    default:
      return false;
  }
}
