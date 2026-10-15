import { Link } from 'react-router-dom';
import EditorialHero from '../../components/feature/EditorialHero';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import { siteContent } from '../../content/site';

const textLink = 'inline-flex min-h-11 items-center gap-3 text-sm font-medium text-[#5B3D48] underline decoration-[#5B3D48]/30 underline-offset-8 transition-colors hover:decoration-[#5B3D48] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#5B3D48]';
const eyebrow = 'text-xs font-medium tracking-[0.18em] text-[#78616A]';
const heading = 'text-3xl font-medium leading-snug text-[#5B3D48] md:text-4xl';

const selectionPrinciples = [
  {
    number: '01',
    title: '從日常需求出發',
    description: '清潔、保濕、舒緩，或是每天的貼身穿著。我們從實際使用的時刻思考，讓每一件選品都有清楚的位置。',
  },
  {
    number: '02',
    title: '把選擇說清楚',
    description: '護理品的用途與使用方式、衣物的材質與尺寸，都是挑選時值得留意的細節。我們希望陪妳理解差異，再做適合自己的選擇。',
  },
  {
    number: '03',
    title: '尊重每個人的感受',
    description: '每個人的肌膚、身形與生活習慣都不同。照顧自己可以依照當下的需要，找到舒服、願意持續的日常步調。',
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#F8F5F1] font-sans text-[#655859]">
      <Header />
      <main className="pt-24">
        <EditorialHero
          image="/images/lucissi-v5/about-hero.webp"
          alt="選品工作桌前，仔細閱讀護理產品包裝的女性"
          eyebrow="ABOUT LUCISSI CARE"
          title="把照顧自己，放回日常裡。"
          description="LUCISSI CARE 從私密護理，到每天貼近肌膚的舒適穿著，為女性挑選更自在的日常選擇。"
        >
          <a href="#our-story" className={`${textLink} mt-6`}>
            認識 LUCISSI <span aria-hidden="true">↓</span>
          </a>
        </EditorialHero>

        <section id="our-story" aria-labelledby="story-title" className="scroll-mt-28 bg-white py-16 md:py-24">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 md:grid-cols-[1fr_1.3fr] md:gap-20 md:px-10">
            <div>
              <p className={eyebrow}>OUR STORY</p>
              <h2 id="story-title" className={`${heading} mt-5`}>
                從貼近身體的小事，<br />開始照顧自己。
              </h2>
            </div>
            <div className="space-y-5 text-base leading-8">
              <p>忙碌的生活裡，我們常常把時間留給工作、家人與待辦事項。留給自己的照顧，可以從每天用的護理品、早晨換上的貼身衣物開始。</p>
              <p>LUCISSI CARE 是為女性日常而生的選品品牌。我們把私密護理與貼身穿著放在一起，因為它們都貼近身體，也貼近生活。</p>
              <p>我們希望，當妳想多照顧自己一點時，這裡有清楚的方向，也有適合妳的日常選擇。</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="selection-title" className="py-16 md:py-24">
          <div className="mx-auto max-w-6xl px-6 md:px-10">
            <div className="mb-10 md:mb-14">
              <p className={eyebrow}>OUR SELECTION</p>
              <h2 id="selection-title" className={`${heading} mt-5`}>貼近妳的兩種日常</h2>
            </div>
            <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16 lg:gap-24">
              <figure>
                <img
                  src="/images/lucissi-v5/about-saengak-portrait.webp"
                  alt="擺放於淺色層架上的私密清潔、噴霧與濕巾選品"
                  className="aspect-[4/5] w-full object-cover"
                  width={768}
                  height={960}
                  loading="lazy"
                />
                <figcaption className="mt-4 text-xs tracking-wider text-[#78616A]">從每天會用到的細節，開始挑選。</figcaption>
              </figure>
              <div className="divide-y divide-[#D9CAC9]">
                <article className="pb-9 md:pb-10">
                  <p className={eyebrow}>01 / INTIMATE CARE</p>
                  <h3 className="mt-4 text-2xl font-medium text-[#5B3D48]">私密護理</h3>
                  <p className="mt-4 text-base leading-8">精選清潔、保濕與舒緩護理，從不同的使用需求出發，為每天的私密日常，多一點舒適與自在。</p>
                  <Link to="/search?category=私密護理" className={`${textLink} mt-5`}>探索私密護理 <span aria-hidden="true">↗</span></Link>
                </article>
                <article className="pt-9 md:pt-10">
                  <p className={eyebrow}>02 / EVERYDAY WEAR</p>
                  <h3 className="mt-4 text-2xl font-medium text-[#5B3D48]">貼身穿著</h3>
                  <p className="mt-4 text-base leading-8">每天貼近肌膚的穿著，也是私密日常的一部分。從材質的觸感、剪裁到穿著情境，陪妳找到自在的貼身選擇。</p>
                  <Link to="/search?category=貼身穿著" className={`${textLink} mt-5`}>探索貼身穿著 <span aria-hidden="true">↗</span></Link>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="approach-title" className="bg-white py-16 md:py-24">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 md:grid-cols-[1.15fr_1fr] md:gap-16 md:px-10 lg:gap-24">
            <div>
              <p className={eyebrow}>THOUGHTFULLY CHOSEN</p>
              <h2 id="approach-title" className={`${heading} mt-5`}>選品，從理解日常開始。</h2>
              <div className="mt-8 divide-y divide-[#E8DFDB]">
                {selectionPrinciples.map((principle) => (
                  <div key={principle.number} className="flex gap-5 py-6 first:pt-0 last:pb-0">
                    <span aria-hidden="true" className="pt-1 text-xs tracking-widest text-[#78616A]">{principle.number}</span>
                    <div>
                      <h3 className="text-lg font-medium text-[#5B3D48]">{principle.title}</h3>
                      <p className="mt-2 text-sm leading-7 md:text-base">{principle.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <img
              src="/images/lucissi-v5/about-daily-portrait.webp"
              alt="出門前，將日常護理噴霧放入肩背包的女性"
              className="aspect-[3/4] w-full object-cover"
              width={768}
              height={1024}
              loading="lazy"
            />
          </div>
        </section>

        <section aria-labelledby="talk-title" className="bg-[#EDE2DE] py-16 md:py-24">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 md:grid-cols-[0.85fr_1fr] md:gap-20 md:px-10 lg:gap-28">
            <img
              src="/images/lucissi-v5/about-balance-portrait.webp"
              alt="穿著柔粉色上衣的女性，在窗邊安靜休息"
              className="aspect-[4/5] w-full object-cover"
              width={768}
              height={960}
              loading="lazy"
            />
            <div>
              <p className={eyebrow}>LUCISSI Talk｜私密對話</p>
              <h2 id="talk-title" className={`${heading} mt-5`}>讓私密，<br />成為可以自在聊的日常。</h2>
              <div className="mt-6 space-y-4 text-base leading-8">
                <p>關於私密照護、貼身穿著，或是身體的細微感受，每個人的經驗都值得被好好聽見。</p>
                <p>在 LUCISSI Talk，我們從生活裡的小提問出發，分享照護觀念與日常靈感。希望妳在閱讀與交流之間，更了解自己的需要，也更自在地談論自己。</p>
              </div>
              <Link to="/community" className={`${textLink} mt-6`}>走進私密對話 <span aria-hidden="true">↗</span></Link>
            </div>
          </div>
        </section>

        <section aria-labelledby="shop-title" className="bg-[#5B3D48] px-6 py-16 text-center text-white md:py-20">
          <div className="mx-auto max-w-2xl">
            <p className="text-xs tracking-[0.18em] text-[#E7D6D4]">A LITTLE CARE, EVERY DAY</p>
            <h2 id="shop-title" className="mt-5 text-3xl font-medium leading-snug text-white md:text-4xl">從今天，多留一點照顧給自己。</h2>
            <p className="mt-5 text-base leading-8 text-[#E7D6D4]">從一件貼近日常的選品開始，找到屬於妳的舒適步調。</p>
            <Link to="/search" className="mt-8 inline-flex min-h-12 items-center justify-center gap-6 bg-[#F8F5F1] px-8 py-3 text-sm font-medium text-[#5B3D48] transition-colors hover:bg-[#E7D6D4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
              開始選購 <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>

        <section aria-labelledby="business-title" className="px-6 py-12 md:px-10 md:py-14">
          <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-[1fr_3fr] md:gap-12">
            <h2 id="business-title" className="text-base font-medium text-[#5B3D48]">營運與聯絡資訊</h2>
            <dl className="grid gap-6 text-sm leading-6 sm:grid-cols-2">
              <div><dt className="text-xs text-[#78616A]">營運公司</dt><dd className="mt-1">{siteContent.legalName}</dd></div>
              <div><dt className="text-xs text-[#78616A]">統一編號</dt><dd className="mt-1">{siteContent.taxId}</dd></div>
              <div><dt className="text-xs text-[#78616A]">登記地址</dt><dd className="mt-1">{siteContent.registeredAddress}</dd></div>
              <div><dt className="text-xs text-[#78616A]">公司信箱</dt><dd className="mt-1"><a href={`mailto:${siteContent.companyEmail}`} className="break-all underline underline-offset-4 hover:text-[#5B3D48]">{siteContent.companyEmail}</a></dd></div>
            </dl>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
