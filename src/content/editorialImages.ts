/**
 * LUCISSI Talk 文章的編輯圖：每篇文章一組依內容生成的圖片（提示詞與來源在 creative/），
 * 預覽卡片與文章主圖構圖不同，另有社群分享與結構化資料用的尺寸。
 * 新增 Shopify 文章時要在這裡登記一組圖，否則會退回通用圖（每篇看起來都一樣）。
 */
interface EditorialCover {
  /** public/images 下的資料夾 */
  dir: 'lucissi-v5' | 'talk';
  /** 檔名的主題代號：thumb-{key}.webp、article-{key}.webp、share-{key}.jpg */
  key: string;
  /** 描述圖片內容並帶出文章主題的替代文字；預覽圖與主圖共用，所以只寫兩者共有的內容 */
  alt: string;
  /** 是否另有結構化資料建議的 4:3 與 1:1 版本（square-{key}.webp、card-{key}.webp） */
  structuredCrops?: boolean;
}

const covers: Record<string, EditorialCover> = {
  'daily-feminine-care-guide': { dir: 'lucissi-v5', key: 'care', alt: '私密噴霧與日常用品，溫和的日常私密護理' },
  'how-to-choose-seamless-underwear': { dir: 'lucissi-v5', key: 'wear', alt: '棉質貼身衣物的布料與車縫細節，挑選內褲材質' },
  'how-we-review-products-and-content': { dir: 'lucissi-v5', key: 'standards', alt: '核對商品包裝標示與筆記，LUCISSI CARE 整理產品資訊的方式' },
  'vaginal-discharge-normal-changes': {
    dir: 'talk', key: 'discharge-cycle', structuredCrops: true,
    alt: '月經週期記錄表上標記幾天的圓點貼紙，旁邊是乾淨的棉質內褲，觀察白帶隨週期的變化',
  },
  'recurrent-intimate-discomfort-follow-up': {
    dir: 'talk', key: 'clinic-follow-up', structuredCrops: true,
    alt: '女性坐在候診區看手機備忘錄，膝上放著藥袋，準備回診時說明反覆的私密不適',
  },
  'intimate-cleansing-less-irritation': {
    dir: 'talk', key: 'gentle-cleansing', structuredCrops: true,
    alt: '浴室只留毛巾、一盆清水與一瓶清潔用品，多餘的清潔用品收到一旁，減少外陰清潔的刺激',
  },
  'intimate-products-purpose-guide': {
    dir: 'talk', key: 'products-by-purpose', structuredCrops: true,
    alt: '口服膠囊、清潔慕斯與保濕凝膠分成三區擺放，依用途與使用部位分辨私密用品',
  },
  'intimate-care-trial-fatigue': {
    dir: 'talk', key: 'product-log', structuredCrops: true,
    alt: '筆記本上的空白表格與排成一列的用品，整理私密保養用品的使用紀錄',
  },
  // 2026-11-21 草稿，店主確認後才在 Shopify 建立；文章未建立前這筆登記不會被用到
  'intimate-cleanser-how-to-choose': {
    dir: 'talk', key: 'cleanser-choice', structuredCrops: true,
    alt: '浴室檯面上並排的慕斯、清潔液與獨立包裝濕巾，一隻手翻到瓶身背面看標示，比較私密處清潔產品的劑型與成分',
  },
  // 2026-11-22 草稿，店主確認後才在 Shopify 建立；文章未建立前這筆登記不會被用到
  'seamless-underwear-pros-cons': {
    dir: 'talk', key: 'seamless-fit', structuredCrops: true,
    alt: '木質檯面上並排攤開的無痕切邊內褲與鬆緊帶純棉內褲，一旁是布尺與細網洗衣袋，比較無痕內褲的切邊、尺寸與清洗方式',
  },
  // 2026-11-22 草稿，店主確認後才在 Shopify 建立；文章未建立前這筆登記不會被用到
  'period-underwear-guide': {
    dir: 'talk', key: 'period-underwear', structuredCrops: true,
    alt: '木質檯面上攤開的高腰生理褲，露出前後加長的淺灰內襯，旁邊是摺好的內褲、獨立包裝衛生棉與絨面收納包，準備經期用品',
  },
  'cotton-vs-ice-silk-underwear': {
    dir: 'talk', key: 'cotton-vs-ice-silk', structuredCrops: true,
    alt: '木托盤上並排的白色純棉三角褲與淺綠色無痕冰絲三角褲，旁邊是棉花枝與一杯冰水，比較兩種布料',
  },
  'intimate-itch-which-doctor': {
    dir: 'talk', key: 'itch-which-doctor', structuredCrops: true,
    alt: '玄關淺木桌上放著帆布托特包、玫瑰色封面筆記本與鉛筆、鑰匙、折好的針織外套和一杯水，準備出門看診',
  },
  'safety-shorts-underwear': {
    dir: 'talk', key: 'safety-shorts', structuredCrops: true,
    alt: '木質抽屜櫃上平放的膚色平口安全褲，旁邊是白色棉質內褲、洗衣網袋與一件玫瑰色百褶長裙，準備穿裙子出門',
  },
  'intimate-odor-without-shame': {
    dir: 'talk', key: 'odor-without-shame', structuredCrops: true,
    alt: '窗邊通風處晾乾的棉質內褲，私密處氣味不必靠香味遮蓋',
  },
};

const DEFAULT_COVER: EditorialCover = covers['how-we-review-products-and-content'];

const coverFor = (handle?: string): EditorialCover | undefined => (handle ? covers[handle] : undefined);

const imagePath = ({ dir, key }: EditorialCover, prefix: string, extension = 'webp') =>
  `/images/${dir}/${prefix}-${key}.${extension}`;

/** 文章預覽卡片（preview）或文章頁主圖（hero）的網址；沒有登記時用 Shopify 文章圖，再退回通用圖。 */
export function editorialImage(handle?: string, supplied?: string | null, placement: 'preview' | 'hero' = 'preview'): string {
  const prefix = placement === 'hero' ? 'article' : 'thumb';
  const cover = coverFor(handle);
  return cover ? imagePath(cover, prefix) : supplied || imagePath(DEFAULT_COVER, prefix);
}

/** 與 editorialImage 對應的替代文字：登記的描述 → Shopify 圖片的 altText → 文章標題。 */
export function editorialImageAlt(handle?: string, supplied?: string | null, title = ''): string {
  return coverFor(handle)?.alt || supplied?.trim() || title;
}

/** 社群分享預覽用的 1200×630 JPG（部分平台不支援 WebP）；沒有對應主題時回傳 undefined。 */
export function editorialShareImage(handle?: string): string | undefined {
  const cover = coverFor(handle);
  return cover ? imagePath(cover, 'share', 'jpg') : undefined;
}

/**
 * BlogPosting 的 image：Google 建議提供 16:9、4:3、1:1 三種比例。
 * 有登記時回傳主體置中的 16:9 預覽圖與 4:3、1:1 裁切；沒有時回傳空陣列。
 */
export function editorialStructuredImages(handle?: string): string[] {
  const cover = coverFor(handle);
  if (!cover?.structuredCrops) return [];
  return [imagePath(cover, 'thumb'), imagePath(cover, 'card'), imagePath(cover, 'square')];
}
