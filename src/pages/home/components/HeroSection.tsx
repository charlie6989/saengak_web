import { useState } from 'react';
import { Link } from 'react-router-dom';

const heroSlides = [
  { image: 'home-welcome', position: 'right center', label: 'LUCISSI CARE', title: '私密照護，從每天的日常開始。', description: '從私密護理，到每天貼近肌膚的舒適穿著，\n為女性挑選更自在的日常選擇。', link: '/search', action: '開始選購', alt: '將隨身護理用品放入收納包的日常片刻' },
  { image: 'home-care', position: 'right center', label: 'SAENGAK', title: '私密照護，從日常開始。', description: '精選清潔、保濕與舒緩護理，為每天的私密日常，多一點舒適與自在。', link: '/search?category=私密護理', action: '認識護理系列', alt: 'Saengak 潔淨慕斯與修護噴霧的透光展示' },
  { image: 'home-wear', position: 'right center', label: 'EVERYDAY COMFORT', title: '貼身穿著', description: '每天貼近肌膚的穿著，也是私密日常的一部分。', link: '/search?category=貼身穿著', action: '探索貼身穿著', alt: '棉質內著自然垂放於柔軟座凳' },
  { image: 'home-conversation', position: 'right center', label: 'LUCISSI CARE TALK', title: '談身體，也談心', description: '在理解與分享之間，慢慢找到屬於自己的照護方式。', link: '/community', action: '閱讀私密對話', alt: '兩位成年女性在早餐檯前溫暖交流' },
  { image: 'home-philosophy', position: 'right center', label: 'OUR PHILOSOPHY', title: '照顧自己，從感受開始', description: '給身體溫柔的照護，也給自己一段安靜的時間。', link: '/about', action: '閱讀品牌理念', alt: '女性在露台門邊留一段安靜的時間給自己' },
];

export default function HeroSection() {
  const [currentSlide, setCurrentSlide] = useState(0);

  return (
    <section aria-label="LUCISSI care 日常照護主題" aria-roledescription="輪播" className="relative h-[650px] md:h-[640px] overflow-hidden bg-[#F8F5F1]">
      {heroSlides.map((slide, index) => (
        <div key={slide.image} aria-hidden={index !== currentSlide} inert={index !== currentSlide} className={`absolute inset-0 flex flex-col md:block ${index === currentSlide ? 'opacity-100 z-10' : 'opacity-0'}`}>
          <div className="h-[330px] shrink-0 md:h-full">
            <img src={`/images/lucissi-v5/${slide.image}.webp`} alt={slide.alt} width={1920} height={1080} fetchPriority={index === 0 ? 'high' : 'auto'} loading={index === 0 ? 'eager' : 'lazy'} className="h-full w-full object-cover md:object-contain" style={{ objectPosition: slide.position }} />
          </div>
          <div className="hidden md:block absolute inset-0 bg-gradient-to-r from-[#F8F5F1] from-[35%] via-[#F8F5F1]/60 via-[48%] to-transparent to-[65%]" />
          <div className="relative px-7 pt-7 pb-16 md:absolute md:inset-0 md:flex md:items-center md:px-[8%] md:py-16">
            <div className="max-w-[540px]">
              <p className="text-xs tracking-[0.22em] text-[#5B3D48] mb-3">{slide.label}</p>
              <h1 className="text-[28px] md:text-5xl font-semibold leading-snug text-[#5B3D48]" style={{ textWrap: 'balance' }}>{index === 0 ? <>私密照護，<br />從每天的日常開始。</> : slide.title}</h1>
              <p className="mt-3 md:mt-5 text-sm md:text-lg leading-relaxed whitespace-pre-line text-[#5F5955]">{slide.description}</p>
              <Link to={slide.link} className="inline-flex mt-5 md:mt-7 border-b border-[#5B3D48] pb-1 text-sm font-medium text-[#5B3D48]">{slide.action}<span aria-hidden="true" className="ml-4">→</span></Link>
            </div>
          </div>
        </div>
      ))}
      <div className="absolute bottom-5 inset-x-0 z-20 flex items-center justify-center gap-4">
        <button onClick={() => setCurrentSlide(prev => (prev - 1 + heroSlides.length) % heroSlides.length)} aria-label="上一張品牌圖片" className="h-9 w-9 rounded-full bg-white/90 text-[#5B3D48]">←</button>
        {heroSlides.map((slide, index) => <button key={slide.image} onClick={() => setCurrentSlide(index)} aria-label={`顯示第 ${index + 1} 張品牌圖片`} aria-pressed={index === currentSlide} className="h-8 px-1"><span className={`block h-1.5 rounded-full bg-[#5B3D48] transition-all ${index === currentSlide ? 'w-7' : 'w-2 opacity-35'}`} /></button>)}
        <button onClick={() => setCurrentSlide(prev => (prev + 1) % heroSlides.length)} aria-label="下一張品牌圖片" className="h-9 w-9 rounded-full bg-white/90 text-[#5B3D48]">→</button>
      </div>
    </section>
  );
}
