import { Link } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import { siteContent } from '../../content/site';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#FBFBF9] text-gray-800 font-sans">
      <Header />

      <main className="pt-[72px]">
        {/* =========================================================================
            1. Hero 主視覺 Banner (櫻花與護理產品雅緻背景)
            ========================================================================= */}
        <section className="relative overflow-hidden bg-[#FAF6F3] py-20 sm:py-28 lg:py-36">
          {/* 背景圖片 (清晰鮮明呈現，維持明亮通透感) */}
          <div className="absolute inset-0 z-0">
            <img
              src="/images/about/hero-bg.jpg"
              alt="Saengak 韓國女性私密日常照護品牌"
              className="h-full w-full object-cover object-right sm:object-center opacity-95"
              loading="eager"
            />
            {/* 輕透柔和漸層，確保左側文字清晰好讀，右側圖片原汁原味鮮明可見 */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#FAF6F3]/90 via-[#FAF6F3]/60 sm:via-[#FAF6F3]/40 to-transparent"></div>
          </div>

          <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#E3EFEA] px-3.5 py-1 text-xs sm:text-sm font-semibold text-[#245B50] tracking-wide mb-6">
                <i className="ri-leaf-line text-xs"></i> 來自韓國的女性私密日常照護品牌
              </span>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 leading-tight">
                Saengak
              </h1>
              <p className="mt-4 text-xl sm:text-2xl font-medium text-gray-700">
                溫和、安心、可長期使用
              </p>
              <p className="mt-6 text-base sm:text-lg leading-relaxed text-gray-600">
                專為女性健康日常護理打造的優質韓國女性護理品牌。在每個生活節奏中，給予私密肌膚最溫柔而持久的舒適守護。
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  to="/search"
                  className="inline-flex items-center justify-center rounded-xl bg-[#245B50] px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-[#1B4D3E] transition-all cursor-pointer"
                >
                  探索全系列商品
                  <i className="ri-arrow-right-line ml-2"></i>
                </Link>
                <a
                  href="#about-saengak"
                  className="inline-flex items-center justify-center rounded-xl bg-white/80 backdrop-blur-xs border border-gray-300 px-6 py-3.5 text-sm font-semibold text-gray-700 hover:bg-white hover:border-[#245B50] transition-all cursor-pointer"
                >
                  閱讀品牌故事
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            2. 章節一：關於 Saengak (About Saengak)
            ========================================================================= */}
        <section id="about-saengak" className="py-20 lg:py-28 bg-white border-b border-gray-100">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="text-xs sm:text-sm font-bold tracking-widest text-[#245B50] uppercase">
                ABOUT SAENGAK
              </span>
              <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
                關於 Saengak
              </h2>
              <p className="mt-4 text-base sm:text-lg leading-relaxed text-gray-600">
                Saengak 是來自韓國的女性私密護理品牌，長期深耕女性私密健康與日常舒緩照護，深受喜愛與支持。
              </p>
              <p className="mt-2 text-sm sm:text-base leading-relaxed text-gray-500">
                我們相信，私密不適不只是身體表面的問題，而是與壓力、情緒與生活節奏息息相關。
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              {/* 左側情境圖卡 */}
              <div className="lg:col-span-5">
                <div className="relative overflow-hidden rounded-2xl shadow-lg border border-gray-100 aspect-[4/5] bg-gray-50">
                  <img
                    src="/images/about/about-care.jpg"
                    alt="Saengak 女性日常護理情境"
                    className="h-full w-full object-cover object-center"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
                  <div className="absolute bottom-6 left-6 right-6 text-white">
                    <p className="text-sm font-semibold tracking-wider text-emerald-200">KOREAN DAILY CARE</p>
                    <p className="text-lg font-bold">融入日常的自然舒緩儀式</p>
                  </div>
                </div>
              </div>

              {/* 右側 3 大特質卡片 */}
              <div className="lg:col-span-7 space-y-6">
                <div className="p-6 sm:p-7 rounded-2xl bg-[#F7F9F8] border border-[#E2EBE6] hover:border-[#245B50]/40 transition-all">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#245B50]/10 text-[#245B50] flex items-center justify-center flex-shrink-0 text-2xl">
                      <i className="ri-heart-pulse-line"></i>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">深耕女性私密健康</h3>
                      <p className="mt-2 text-sm sm:text-base leading-relaxed text-gray-600">
                        長期專注於女性私密健康與日常舒緩照護，以嚴謹標準與純淨初心，守護女性日常健康。
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-6 sm:p-7 rounded-2xl bg-[#F7F9F8] border border-[#E2EBE6] hover:border-[#245B50]/40 transition-all">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#245B50]/10 text-[#245B50] flex items-center justify-center flex-shrink-0 text-2xl">
                      <i className="ri-mental-health-line"></i>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">身心連結的深刻理解</h3>
                      <p className="mt-2 text-sm sm:text-base leading-relaxed text-gray-600">
                        私密不適往往不只是身體表面的微小變化，更與現代女性日常面臨的壓力、情緒起伏與生活節奏息息相關。
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-6 sm:p-7 rounded-2xl bg-[#F7F9F8] border border-[#E2EBE6] hover:border-[#245B50]/40 transition-all">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#245B50]/10 text-[#245B50] flex items-center justify-center flex-shrink-0 text-2xl">
                      <i className="ri-time-line"></i>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">日常照護的溫柔陪伴</h3>
                      <p className="mt-2 text-sm sm:text-base leading-relaxed text-gray-600">
                        陪伴女性在每個生活節奏中，維持私密肌膚的舒適與穩定，讓每一次清潔與修護都成為放鬆時刻。
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            3. 章節二：溫和、安心、可長期使用 (Core Product Philosophy)
            ========================================================================= */}
        <section className="py-20 lg:py-28 bg-[#FAF8F5]">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="text-xs sm:text-sm font-bold tracking-widest text-[#245B50] uppercase">
                PRODUCT PHILOSOPHY
              </span>
              <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
                溫和、安心、可長期使用
              </h2>
              <p className="mt-4 text-base sm:text-lg text-gray-600">
                Saengak 的產品核心理念 — 不追求刺激性的即時效果，回歸自然與安心
              </p>
            </div>

            {/* 3 大核心主張卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
              <div className="bg-white p-8 rounded-2xl border border-gray-200/80 shadow-xs hover:shadow-md transition-all text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-[#E3EFEA] text-[#245B50] flex items-center justify-center text-2xl mb-5">
                  <i className="ri-plant-line"></i>
                </div>
                <h3 className="text-xl font-bold text-gray-900">溫和配方</h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">
                  不追求刺激性的即時效果，精選植萃與親膚成分，以溫和配方細膩呵護私密肌膚微生態。
                </p>
              </div>

              <div className="bg-white p-8 rounded-2xl border border-gray-200/80 shadow-xs hover:shadow-md transition-all text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-[#E3EFEA] text-[#245B50] flex items-center justify-center text-2xl mb-5">
                  <i className="ri-shield-check-line"></i>
                </div>
                <h3 className="text-xl font-bold text-gray-900">品質安心把關</h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">
                  通過專業品質標準與嚴格安全把關，杜絕有害添加，確保每一款產品都值得長期信賴。
                </p>
              </div>

              <div className="bg-white p-8 rounded-2xl border border-gray-200/80 shadow-xs hover:shadow-md transition-all text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-[#E3EFEA] text-[#245B50] flex items-center justify-center text-2xl mb-5">
                  <i className="ri-calendar-check-line"></i>
                </div>
                <h3 className="text-xl font-bold text-gray-900">日常可用</h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">
                  專為日常規律護理打造，適合 365 天長期使用，讓私密照護無負擔地融入生活日常。
                </p>
              </div>
            </div>

            {/* 陪伴生活節奏亮點卡片 (左文右圖) */}
            <div className="bg-white rounded-3xl overflow-hidden border border-gray-200/90 shadow-sm grid grid-cols-1 lg:grid-cols-12 items-center">
              <div className="p-8 sm:p-12 lg:col-span-7 space-y-6">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#245B50] bg-[#E3EFEA] px-3 py-1 rounded-full">
                  <i className="ri-sparkling-line"></i> DAILY COMPANION
                </span>
                <h3 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  陪伴每個生活節奏
                </h3>
                <p className="text-sm sm:text-base leading-relaxed text-gray-600">
                  Saengak 以溫和、安全與日常可用為產品核心，不追求刺激性的即時效果，而是陪伴女性在每個生活節奏中，維持私密肌膚的舒適與穩定。
                </p>
                <p className="text-sm sm:text-base leading-relaxed text-gray-600">
                  我們相信，真正的照護不是短暫的解決方案，而是能夠長期信賴、安心使用的日常陪伴。讓照護回歸自然與安心，這是 Saengak 對每一位女性的真摯承諾。
                </p>
              </div>
              <div className="lg:col-span-5 h-full min-h-[320px]">
                <img
                  src="/images/about/daily-companion.jpg"
                  alt="陪伴女性每個生活節奏"
                  className="h-full w-full object-cover object-center"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            4. 章節三：由內而外的照護理念 (Saengak × INNERSÉN)
            ========================================================================= */}
        <section className="py-20 lg:py-28 bg-white border-b border-gray-100">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="text-xs sm:text-sm font-bold tracking-widest text-[#245B50] uppercase">
                HOLISTIC CARE
              </span>
              <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
                由內而外的照護理念
              </h2>
              <p className="mt-4 text-base sm:text-lg text-gray-600">
                Saengak × INNERSÉN 的心身平衡結合
              </p>
            </div>

            {/* 主特色卡片 (左圖右文) */}
            <div className="bg-[#FAF9F7] rounded-3xl overflow-hidden border border-gray-200/90 shadow-xs grid grid-cols-1 lg:grid-cols-12 items-center mb-12">
              <div className="lg:col-span-5 h-full min-h-[340px]">
                <img
                  src="/images/about/innersen-balance.jpg"
                  alt="INNERSÉN 心身平衡理念"
                  className="h-full w-full object-cover object-center"
                  loading="lazy"
                />
              </div>
              <div className="p-8 sm:p-12 lg:col-span-7 space-y-5">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#245B50] bg-[#E3EFEA] px-3 py-1 rounded-full">
                  <i className="ri-infinity-line"></i> INNERSÉN 心身平衡
                </span>
                <h3 className="text-2xl sm:text-3xl font-bold text-gray-900">
                  INNERSÉN 心身平衡理念
                </h3>
                <p className="text-sm sm:text-base leading-relaxed text-gray-600">
                  作為 INNERSÉN 心身平衡理念 所引入的女性私密護理品牌，Saengak 從身體感受層級出發，與 INNERSÉN 專注的內在調節理念相互呼應。
                </p>
                <p className="text-sm sm:text-base leading-relaxed text-gray-600">
                  我們相信，真正的健康與美麗來自於身心的和諧平衡。外在的照護需要內在的支持，內在的調節也需要外在的呵護。這種由內而外的女性照護觀點，讓 Saengak 不僅僅是一個護理品牌，更是女性追求整體健康與幸福的重要夥伴。
                </p>
              </div>
            </div>

            {/* 4 大維度矩陣小卡 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="p-6 rounded-2xl bg-white border border-gray-200/80 shadow-2xs hover:border-[#245B50] transition-all">
                <div className="w-10 h-10 rounded-lg bg-[#245B50]/10 text-[#245B50] flex items-center justify-center text-xl mb-4">
                  <i className="ri-hand-heart-line"></i>
                </div>
                <h4 className="text-base font-bold text-gray-900">身體感受</h4>
                <p className="mt-2 text-xs sm:text-sm text-gray-500 leading-relaxed">
                  從肌膚與身體第一線感受出發，打造極致親膚溫和的日常護理體驗。
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white border border-gray-200/80 shadow-2xs hover:border-[#245B50] transition-all">
                <div className="w-10 h-10 rounded-lg bg-[#245B50]/10 text-[#245B50] flex items-center justify-center text-xl mb-4">
                  <i className="ri-lightbulb-line"></i>
                </div>
                <h4 className="text-base font-bold text-gray-900">內在調節</h4>
                <p className="mt-2 text-xs sm:text-sm text-gray-500 leading-relaxed">
                  專注於內在微生態與生活節奏的調和，由根本維持穩定與舒適。
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white border border-gray-200/80 shadow-2xs hover:border-[#245B50] transition-all">
                <div className="w-10 h-10 rounded-lg bg-[#245B50]/10 text-[#245B50] flex items-center justify-center text-xl mb-4">
                  <i className="ri-user-heart-line"></i>
                </div>
                <h4 className="text-base font-bold text-gray-900">外在呵護</h4>
                <p className="mt-2 text-xs sm:text-sm text-gray-500 leading-relaxed">
                  細膩舒緩外界環境對私密肌膚帶來的刺激，給予無微不至的長效防護。
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white border border-gray-200/80 shadow-2xs hover:border-[#245B50] transition-all">
                <div className="w-10 h-10 rounded-lg bg-[#245B50]/10 text-[#245B50] flex items-center justify-center text-xl mb-4">
                  <i className="ri-scales-3-line"></i>
                </div>
                <h4 className="text-base font-bold text-gray-900">整體平衡</h4>
                <p className="mt-2 text-xs sm:text-sm text-gray-500 leading-relaxed">
                  追求身、心、肌膚三者之間的和諧共振，實現整體健康與自在。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            5. 章節四：Saengak × INNERSÉN 核心宣言 (Brand Manifesto)
            ========================================================================= */}
        <section className="py-20 lg:py-24 bg-[#FAF6F3] text-center border-b border-gray-100">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <span className="text-xs sm:text-sm font-bold tracking-widest text-[#245B50] uppercase">
              MANIFESTO
            </span>
            <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold text-gray-900">
              Saengak × INNERSÉN
            </h2>
            <p className="mt-4 text-2xl sm:text-3xl font-bold text-[#245B50] leading-snug">
              「由內而外，守護女性的心身平衡。」
            </p>
            <div className="mt-6 max-w-2xl mx-auto space-y-3 text-sm sm:text-base leading-relaxed text-gray-600 font-normal">
              <p>我們相信，真正的美麗與健康來自於身心的和諧。</p>
              <p>Saengak 與 INNERSÉN 攜手，為每一位女性提供全方位的日常照護，</p>
              <p>讓妳在每個生活節奏中，都能時刻感受到身心的平衡與舒適自在。</p>
            </div>
          </div>
        </section>

        {/* =========================================================================
            6. 章節五：行動呼籲 (CTA Section - 墨綠色質感背景)
            ========================================================================= */}
        <section className="bg-[#1B4D3E] py-16 sm:py-20 text-white text-center">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              體驗 Saengak 的溫柔照護
            </h2>
            <p className="mt-4 text-base sm:text-lg text-emerald-100 max-w-xl mx-auto">
              讓我們陪伴妳，在每個生活節奏中維持私密肌膚的舒適與穩定。
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                to="/search"
                className="inline-flex items-center justify-center rounded-xl bg-white px-8 py-3.5 text-sm font-bold text-[#1B4D3E] shadow-sm hover:bg-emerald-50 transition-all cursor-pointer"
              >
                探索產品
                <i className="ri-arrow-right-line ml-2"></i>
              </Link>
              <Link
                to="/faq"
                className="inline-flex items-center justify-center rounded-xl border border-white/40 bg-transparent px-8 py-3.5 text-sm font-semibold text-white hover:bg-white/10 transition-all cursor-pointer"
              >
                常見問題
              </Link>
            </div>
          </div>
        </section>

        {/* =========================================================================
            7. 章節六：營運與法定資訊 (與品牌風格完美融合的雅緻排版)
            ========================================================================= */}
        <section className="py-20 lg:py-24 bg-[#FAF9F7] border-t border-gray-200/60">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <span className="text-xs sm:text-sm font-bold tracking-widest text-[#245B50] uppercase">
                LEGAL & BUSINESS INFORMATION
              </span>
              <h2 className="mt-2.5 text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                營運與法定資訊
              </h2>
              <p className="mt-3 text-xs sm:text-sm text-gray-500 leading-relaxed">
                透明揭露營運主體與法定登記資料，為每位顧客提供安心透明的消費保障
              </p>
            </div>

            {/* 3 欄式優雅卡片網格 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* 卡片 1: 企業登記 */}
              <div className="bg-white p-7 sm:p-8 rounded-2xl border border-gray-200/80 shadow-2xs hover:border-[#245B50]/30 transition-all flex flex-col justify-between">
                <div>
                  <div className="w-11 h-11 rounded-xl bg-[#E3EFEA] text-[#245B50] flex items-center justify-center text-xl mb-5">
                    <i className="ri-building-4-line"></i>
                  </div>
                  <h3 className="text-base font-bold text-gray-900">企業登記</h3>
                  <div className="mt-4 space-y-2.5 text-sm">
                    <div>
                      <span className="text-xs text-gray-400 block mb-0.5">營運公司</span>
                      <span className="font-semibold text-gray-800">{siteContent.legalName}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block mb-0.5">統一編號</span>
                      <span className="font-mono text-gray-700 bg-gray-50 px-2 py-0.5 rounded border border-gray-100 inline-block">
                        {siteContent.taxId}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 卡片 2: 聯繫與客服 */}
              <div className="bg-white p-7 sm:p-8 rounded-2xl border border-gray-200/80 shadow-2xs hover:border-[#245B50]/30 transition-all flex flex-col justify-between">
                <div>
                  <div className="w-11 h-11 rounded-xl bg-[#E3EFEA] text-[#245B50] flex items-center justify-center text-xl mb-5">
                    <i className="ri-mail-send-line"></i>
                  </div>
                  <h3 className="text-base font-bold text-gray-900">聯絡與服務</h3>
                  <div className="mt-4 space-y-2.5 text-sm">
                    <div>
                      <span className="text-xs text-gray-400 block mb-0.5">公司信箱</span>
                      <a
                        href={`mailto:${siteContent.companyEmail}`}
                        className="text-[#245B50] font-medium hover:underline inline-flex items-center gap-1"
                      >
                        {siteContent.companyEmail}
                        <i className="ri-external-link-line text-xs"></i>
                      </a>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block mb-0.5">客服狀態</span>
                      <span className="text-xs leading-relaxed text-gray-600 block">
                        {siteContent.supportStatus}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 卡片 3: 地址與盤點 */}
              <div className="bg-white p-7 sm:p-8 rounded-2xl border border-gray-200/80 shadow-2xs hover:border-[#245B50]/30 transition-all flex flex-col justify-between">
                <div>
                  <div className="w-11 h-11 rounded-xl bg-[#E3EFEA] text-[#245B50] flex items-center justify-center text-xl mb-5">
                    <i className="ri-map-pin-2-line"></i>
                  </div>
                  <h3 className="text-base font-bold text-gray-900">登記地址與盤點</h3>
                  <div className="mt-4 space-y-2.5 text-sm">
                    <div>
                      <span className="text-xs text-gray-400 block mb-0.5">登記地址</span>
                      <span className="text-gray-700 leading-relaxed block text-xs sm:text-sm">
                        {siteContent.registeredAddress}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block mb-0.5">內容盤點</span>
                      <span className="text-xs text-gray-500 font-mono">
                        {siteContent.contentReviewedAt}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
