import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import { siteContent } from '../../content/site';

const principles = [
  ['資料先於宣稱', '成分、容量、產地、認證與測試資訊必須能回到 Shopify 商品欄位、包裝或可稽核文件；缺少來源時不自行補寫。'],
  ['日常照護，不代替醫療', '產品與文章只提供一般日常照護資訊；若有持續不適、疼痛或其他症狀，應尋求合格醫療專業人員協助。'],
  ['服務狀態透明', '正式金流已啟用；物流、發票、客服與評價仍依各自驗收狀態顯示，不把未完成項目包裝成正式服務。'],
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-stone-50 text-gray-800">
      <Header />
      <main>
        <section className="bg-[#225B4F] px-5 pb-20 pt-40 text-white">
          <div className="mx-auto max-w-5xl">
            <p className="mb-4 text-sm font-medium tracking-[0.2em] text-emerald-100">ABOUT {siteContent.brandName}</p>
            <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-6xl">把女性日常護理做成清楚、可追溯的選擇</h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-emerald-50">SAENGAK 現階段以女性日常護理商品目錄與內容整理為核心。品牌來源、商品功效與檢測資料仍須逐項由正式文件確認。</p>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-5 py-16">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
            <p className="font-semibold">品牌敘事審閱中</p>
            <p className="mt-2 leading-7">舊版本含有未附來源的市場信賴、全球實驗室、醫療合作、絕對安全與天然成分宣稱，現已從公開品牌頁移除。待品牌授權、原廠文件與商品證明齊全後，再補上可驗證的故事。</p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {principles.map(([title, description]) => (
              <article key={title} className="rounded-2xl bg-white p-7 shadow-sm">
                <h2 className="text-xl font-semibold text-[#225B4F]">{title}</h2>
                <p className="mt-4 text-sm leading-7 text-gray-600">{description}</p>
              </article>
            ))}
          </div>

          <section className="mt-12 rounded-2xl bg-white p-7 shadow-sm">
            <h2 className="text-2xl font-semibold">營運資訊</h2>
            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-[9rem_1fr]">
              <dt className="text-gray-500">營運公司</dt><dd>{siteContent.legalName}</dd>
              <dt className="text-gray-500">統一編號</dt><dd>{siteContent.taxId}</dd>
              <dt className="text-gray-500">公司信箱</dt><dd><a href={`mailto:${siteContent.companyEmail}`} className="text-teal-700 hover:underline">{siteContent.companyEmail}</a></dd>
              <dt className="text-gray-500">登記地址</dt><dd>{siteContent.registeredAddress}</dd>
              <dt className="text-gray-500">客服狀態</dt><dd>{siteContent.supportStatus}</dd>
              <dt className="text-gray-500">內容盤點</dt><dd>{siteContent.contentReviewedAt}</dd>
            </dl>
          </section>
        </section>
      </main>
      <Footer />
    </div>
  );
}
