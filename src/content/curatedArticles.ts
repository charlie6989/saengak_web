/**
 * LUCISSI Talk 的站內精選文章（已審視、不含身份或療效宣稱）。
 * 網站文章頁、文章列表、sitemap、伺服器 head（middleware）與社群分享預覽共用這份資料。
 * 帶公開標籤的 Shopify 文章優先：Shopify 有任何公開文章時只用 Shopify 文章（精選文章的網址視同不存在）；
 * 沒有公開文章或 Shopify 讀取失敗時才使用這裡的文章。規則見 publicArticleSet。
 * 本檔不可 import 其他模組（middleware 與 api 函式直接載入）。
 */
export interface CuratedArticle {
  id: string;
  title: string;
  handle: string;
  excerpt: string;
  contentHtml: string;
  publishedAt: string;
  image: { url: string; altText: string };
  blog: { handle: string; title: string };
  author: string;
  tags: string[];
}

export const CURATED_ARTICLES: CuratedArticle[] = [
  {
    id: 'fallback-article-1',
    title: '日常私密護理：先理解身體，再選擇產品',
    handle: 'daily-feminine-care-guide',
    excerpt: '從溫和清潔、生活習慣到何時應尋求專業協助，建立可長期執行的溫和照護原則。',
    contentHtml: `
<p class="lead text-lg mb-6 leading-relaxed">女性私密肌膚具有獨特的生理結構與自淨微生態。建立正確的日常清潔與生活觀念，能幫助維持舒適清爽的健康狀態。</p>

<h2 class="text-2xl font-bold mb-4 mt-8" style="color: #225B4F;">一、 理解私密處的微生態平衡</h2>
<p class="mb-4 leading-relaxed">健康的女性私密微環境呈現弱酸性狀態（pH 3.5～4.5），主要由乳酸菌菌群維持平衡，形成天然屏障。維持微生態穩定的核心在於「不破壞自然平衡」，而非過度追求無菌。</p>
<p class="mb-6 leading-relaxed">日常生活中，荷爾蒙波動、作息壓力、衣物不透氣或過度清潔，都可能暫時影響微生態平衡。</p>

<h2 class="text-2xl font-bold mb-4 mt-8" style="color: #225B4F;">二、 日常清潔的三大溫和守則</h2>
<h3 class="text-xl font-semibold mb-2 mt-4" style="color: #333333;">1. 分區清潔，嚴禁灌洗</h3>
<p class="mb-4 leading-relaxed">陰道內部具備自然的自淨機制，<strong>平時切勿灌洗陰道內部</strong>，以免沖洗掉健康的好菌菌群。外陰部則可使用清水或溫和弱酸性潔膚露輕柔洗滌。</p>

<h3 class="text-xl font-semibold mb-2 mt-4" style="color: #333333;">2. 水溫控制與手法輕柔</h3>
<p class="mb-4 leading-relaxed">清潔時水溫建議維持在 37℃～40℃ 溫涼感，避免過熱熱水造成水分流失與乾燥。清潔後以乾淨柔軟的毛巾「輕壓拍乾」，切忌用力摩擦。</p>

<h3 class="text-xl font-semibold mb-2 mt-4" style="color: #333333;">3. 正確的擦拭順序</h3>
<p class="mb-6 leading-relaxed">如廁後的擦拭習慣至關重要，應始終保持<strong>「由前往後」</strong>的擦拭方向，避免將微生物帶至前方敏感區域。</p>

<h2 class="text-2xl font-bold mb-4 mt-8" style="color: #225B4F;">三、 健康生活與穿著習慣</h2>
<ul class="list-disc list-inside space-y-2 mb-6 leading-relaxed">
<li><strong>選擇透氣棉質內著：</strong> 保持局部通風乾燥，減少悶熱環境。</li>
<li><strong>生理期勤加更換：</strong> 每 2～3 小時更換衛生棉或棉條，保持乾爽。</li>
<li><strong>作息規律與水分補充：</strong> 充足飲水並避免憋尿，維持良好代謝。</li>
</ul>

<h2 class="text-2xl font-bold mb-4 mt-8" style="color: #225B4F;">四、 何時應尋求專科醫師協助？</h2>
<p class="mb-6 leading-relaxed">日常護理產品僅供外在潔淨與舒適維持，不具備任何醫療與治療效果。若您發現分泌物顏色、氣味異常（如豆腐渣狀、黃綠色或異味），或伴隨局部紅腫灼熱、排尿不適時，請務必第一時間尋求合格婦產科醫師的專業診斷與協助，切勿自行使用偏方或成藥。</p>

<div class="p-6 rounded-xl my-8 border border-emerald-200 bg-emerald-50/50">
<p class="text-sm text-emerald-900 leading-relaxed font-medium"><strong>貼心提醒：</strong> 本專欄內容為日常衛生習慣與一般生活衛教分享，不能取代個別醫療診斷。如有任何健康疑問，請諮詢合格專業醫師。</p>
</div>
    `.trim(),
    publishedAt: '2026-09-01T10:37:30Z',
    image: {
      url: '/images/blog/daily-feminine-care-guide.jpg',
      altText: '日常私密護理指南',
    },
    blog: { handle: 'care-talk', title: 'LUCISSI Talk' },
    author: 'LUCISSI CARE 編輯團隊',
    tags: ['SAENGAK', '健康知識', '私密護理', '日常保養', '公開'],
  },
  {
    id: 'fallback-article-2',
    title: '貼身衣物材質怎麼選？透氣、摩擦與清潔頻率的日常指南',
    handle: 'how-to-choose-seamless-underwear',
    excerpt: '用透氣度、摩擦感與清潔頻率三個面向，整理日常挑選貼身衣物的實用重點。',
    contentHtml: `
<p class="lead text-lg mb-6 leading-relaxed">貼身衣物是每天與肌膚接觸時間最長的物品。選對合適的材質與剪裁，是維持一整天清爽舒適的重要起點。</p>

<h2 class="text-2xl font-bold mb-4 mt-8" style="color: #225B4F;">一、 常見貼身衣物面料特性比較</h2>
<p class="mb-4 leading-relaxed">不同面料在吸濕性、透氣度與親膚感上各有優勢，可依個人穿著習慣與場景選擇：</p>

<h3 class="text-xl font-semibold mb-2 mt-4" style="color: #333333;">1. 天然純棉 (Cotton)</h3>
<p class="mb-4 leading-relaxed">天然植物纖維，觸感親膚柔軟、吸濕性佳，不易引起摩擦不適，非常適合居家休閒、睡眠與一般日常穿著。</p>

<h3 class="text-xl font-semibold mb-2 mt-4" style="color: #333333;">2. 莫代爾 (Modal) 與天絲 (Tencel)</h3>
<p class="mb-4 leading-relaxed">萃取自天然木漿纖維，質地絲滑細緻、垂墜感佳，且具備優異的透氣與散熱特性，在夏季或久坐辦公環境能有效減少悶熱感。</p>

<h3 class="text-xl font-semibold mb-2 mt-4" style="color: #333333;">3. 機能彈性人造纖維</h3>
<p class="mb-6 leading-relaxed">多為尼龍與彈性纖維混紡，具備快乾、高彈性與貼合無痕特點，適合運動、健身或穿著貼身裙褲時使用。</p>

<h2 class="text-2xl font-bold mb-4 mt-8" style="color: #225B4F;">二、 挑選時的三大核心關鍵</h2>
<ul class="list-disc list-inside space-y-2 mb-6 leading-relaxed">
<li><strong>底襠材質最關鍵：</strong> 接觸私密處的襠部布料，優先選擇純棉或親膚透氣結構，給予最溫柔的保護。</li>
<li><strong>合身不勒肉：</strong> 避免過度緊繃的腰圍與大腿圍剪裁，減少皮膚受壓摩擦與勒痕。</li>
<li><strong>依場合替換：</strong> 日常放鬆選棉質或天絲，運動流汗選排汗速乾款。</li>
</ul>

<h2 class="text-2xl font-bold mb-4 mt-8" style="color: #225B4F;">三、 貼身衣物清潔與汰舊原則</h2>
<p class="mb-4 leading-relaxed">貼身衣物的清潔方式直接影響布料壽命與衛生狀態：</p>
<ol class="list-decimal list-inside space-y-2 mb-6 leading-relaxed">
<li><strong>使用專用溫和洗劑：</strong> 建議使用中性或貼身衣物手洗精，避免強鹼洗劑殘留刺激肌膚。</li>
<li><strong>獨立手洗或加裝洗衣袋：</strong> 避免與外出衣物、襪子混洗，防止交叉污染。</li>
<li><strong>充分通風晾乾：</strong> 陽光自然晾曬或通風處完全陰乾後再收納，避免潮濕滋生黴菌。</li>
<li><strong>定期更換週期：</strong> 貼身衣物屬於消耗品，建議每 3～6 個月定期更換新內著，若布料變硬、鬆弛或變形應提前汰換。</li>
</ol>
    `.trim(),
    publishedAt: '2026-09-01T10:37:33Z',
    image: {
      url: '/images/blog/how-to-choose-seamless-underwear.jpg',
      altText: '貼身衣物材質指南',
    },
    blog: { handle: 'lifestyle', title: '生活美學' },
    author: 'LUCISSI CARE 編輯團隊',
    tags: ['SAENGAK', '選購指南', '生活美學', '親膚材質', '公開'],
  },
  {
    id: 'fallback-article-3',
    title: '我們如何整理產品與內容：LUCISSI CARE 編輯團隊的透明度承諾',
    handle: 'how-we-review-products-and-content',
    excerpt: '所有產品資訊堅持來源透明與成分公開；沒有即時評價時，就以編輯精選清楚標示。',
    contentHtml: `
<p class="lead text-lg mb-6 leading-relaxed">在資訊繁雜的現代生活中，LUCISSI CARE 堅持以透明、真實與科學尊重的態度，為每一位女性整理真正需要的日常好物與知識內容。</p>

<h2 class="text-2xl font-bold mb-4 mt-8" style="color: #225B4F;">一、 LUCISSI CARE 的編輯守則與透明度承諾</h2>
<p class="mb-4 leading-relaxed">我們相信，好的生活品牌不需要誇張的話術，而是透過誠實的資訊傳遞，讓使用者能安心做決定：</p>

<h3 class="text-xl font-semibold mb-2 mt-4" style="color: #333333;">1. 來源清楚，成分完全透明</h3>
<p class="mb-4 leading-relaxed">所有產品的成份清單、原廠檢測說明與適用建議，均經嚴格核對後如實呈現，絕不隱匿任何資訊，讓每一項接觸肌膚的成分都能安心溯源。</p>

<h3 class="text-xl font-semibold mb-2 mt-4" style="color: #333333;">2. 堅守非醫療宣稱界線</h3>
<p class="mb-4 leading-relaxed">日常護理的本質是溫和清潔、舒適陪伴與維持清爽。我們嚴格遵守衛生主管機關法規，絕不宣稱任何醫療療效，讓護理回歸純粹自然的日常享受。</p>

<h3 class="text-xl font-semibold mb-2 mt-4" style="color: #333333;">3. 真實標示，拒絕虛假評價</h3>
<p class="mb-6 leading-relaxed">在網站展示階段，若尚未取得經本人授權與真實訂單驗證的使用者評價，我們一律明確標示為「編輯精選」，絕不使用合成的評分或虛假心得欺瞞使用者。</p>

<h2 class="text-2xl font-bold mb-4 mt-8" style="color: #225B4F;">二、 我們如何挑選與推薦商品？</h2>
<ul class="list-disc list-inside space-y-2 mb-6 leading-relaxed">
<li><strong>親膚溫和優先：</strong> 優先挑選通過低刺激測試、成分溫和的大廠配方與天然原料。</li>
<li><strong>細節舒適體驗：</strong> 從按壓瓶器的手感、細緻泡沫的觸感，到布料貼合的舒適度，以女性真實日常需求出發。</li>
<li><strong>簡約美學生活：</strong> 摒除過度繁複的包裝，以自然綠意與米白素雅融入居家生活空間。</li>
</ul>

<h2 class="text-2xl font-bold mb-4 mt-8" style="color: #225B4F;">三、 陪伴妳的每一個日常</h2>
<p class="mb-6 leading-relaxed">LUCISSI CARE 期待成為妳生活裡最值得信賴的溫柔力量。在照顧身體的路上，我們與妳一同用心聆聽身體的真實聲音。</p>
    `.trim(),
    publishedAt: '2026-09-01T10:37:36Z',
    image: {
      url: '/images/blog/how-we-review-products-and-content.jpg',
      altText: 'LUCISSI CARE 品牌編輯標準',
    },
    blog: { handle: 'brand', title: '品牌方法' },
    author: 'LUCISSI CARE 編輯團隊',
    tags: ['SAENGAK', '品牌方法', '透明原則', '編輯守則', '公開'],
  },
];

export function findCuratedArticle(handle: string | null | undefined): CuratedArticle | undefined {
  return handle ? CURATED_ARTICLES.find((article) => article.handle === handle) : undefined;
}

/**
 * 網站實際公開的文章：Shopify 有帶公開標籤的文章時只用它們，否則（沒有或讀取失敗 = null）用站內精選文章。
 * 網站、sitemap、middleware 與分享預覽都用這個規則，同一個網址才不會在不同地方有不同結果。
 */
export function publicArticleSet<T>(shopifyPublicArticles: T[] | null | undefined): Array<T | CuratedArticle> {
  return shopifyPublicArticles?.length ? shopifyPublicArticles : CURATED_ARTICLES;
}
