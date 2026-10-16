import { Link } from 'react-router-dom';
import { CARE_PILLARS } from '../../../content/carePillars';

/** 首頁五個照護面向入口：桌機五欄，手機橫向捲動。 */
export default function PillarSection() {
  return (
    <section aria-labelledby="care-pillars-title" className="bg-white py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-6">
        <p className="mb-3 text-xs font-medium tracking-[0.18em] text-brand">LUCISSI CARE · FIVE WAYS TO CARE</p>
        <h2 id="care-pillars-title" className="mb-3 text-3xl font-semibold text-brand md:text-4xl" style={{ textWrap: 'balance' }}>
          從頭到腳，<br className="md:hidden" />照顧每一個日常
        </h2>
        <p className="mb-10 max-w-2xl text-base leading-relaxed text-gray-500 md:text-lg">
          私密與身體保養、肌膚保養、舒適內搭和輕盈運動，依照自己的需要開始。
        </p>
        <ul className="no-scrollbar -mx-6 flex snap-x gap-4 overflow-x-auto px-6 md:mx-0 md:grid md:grid-cols-5 md:overflow-visible md:px-0">
          {CARE_PILLARS.map((pillar) => (
            <li key={pillar.id} className="w-[62%] shrink-0 snap-start sm:w-[40%] md:w-auto">
              <Link to={`/search?category=${pillar.name}`} className="group flex h-full flex-col border border-gray-200 bg-ivory">
                <div className="aspect-4/5 overflow-hidden bg-blush">
                  <img src={pillar.cardImage} alt={pillar.cardAlt} loading="lazy" className="h-full w-full object-cover" />
                </div>
                <div className="flex flex-1 flex-col gap-1 p-4">
                  <p className="text-[11px] font-medium tracking-[0.16em] text-gray-500">{pillar.eyebrow}</p>
                  <h3 className="text-lg font-semibold text-brand">{pillar.name}</h3>
                  <p className="text-sm leading-6 text-gray-500">{pillar.teaser}</p>
                  <span className="mt-auto pt-3 text-sm font-medium text-brand group-hover:underline">
                    看看{pillar.name}<span aria-hidden="true" className="ml-2">→</span>
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
