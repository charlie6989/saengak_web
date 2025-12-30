
import { useState, useEffect } from 'react';

const heroSlides = [
  {
    desktop: 'https://hlbhc.cafe24.com/product_detail/board/KakaoTalk_20250716_102218989_09.jpg',
    mobile: 'https://hlbhc.cafe24.com/product_detail/board/KakaoTalk_20250716_102218989.jpg',
    link: '/product/balance-whipped-wash'
  },
  {
    desktop: 'https://hlbhc.cafe24.com/product_detail/board/KakaoTalk_20250716_102218989_05.jpg',
    mobile: 'https://hlbhc.cafe24.com/product_detail/board/F.jpg',
    link: '/product/feminine-calming-mist'
  },
  {
    desktop: 'https://hlbhc.cafe24.com/product_detail/board/KakaoTalk_20250716_103053359_02.jpg',
    mobile: 'https://hlbhc.cafe24.com/product_detail/board/KakaoTalk_20250716_103053359_01.jpg',
    link: '/product/inner-care-gel'
  },
  {
    desktop: 'https://hlbhc.cafe24.com/product_detail/board/KakaoTalk_20250716_102218989_07.jpg',
    mobile: 'https://hlbhc.cafe24.com/product_detail/board/KakaoTalk_20250716_102218989_03.jpg',
    link: '/product/foaming-wash'
  },
  {
    desktop: 'https://hlbhc.cafe24.com/product_detail/board/KakaoTalk_20250716_102218989_08.jpg',
    mobile: 'https://hlbhc.cafe24.com/product_detail/board/KakaoTalk_20250716_102218989_04.jpg',
    link: '/product/feminine-tissue'
  }
];

export default function HeroSection() {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);
  };

  return (
    <section className="relative h-screen overflow-hidden bg-gray-50">
      {/* 輪播圖片 */}
      <div className="relative w-full h-full">
        {heroSlides.map((slide, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-500 ${
              index === currentSlide ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <a href={slide.link} className="block w-full h-full">
              {/* 桌面版圖片 */}
              <img
                src={slide.desktop}
                alt={`內心想法產品 ${index + 1}`}
                className="hidden md:block w-full h-full object-cover object-center"
              />
              {/* 手機版圖片 */}
              <img
                src={slide.mobile}
                alt={`內心想法產品 ${index + 1}`}
                className="md:hidden w-full h-full object-cover object-center"
              />
            </a>
          </div>
        ))}
      </div>

      {/* 導航按鈕 */}
      <button
        onClick={prevSlide}
        className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center bg-white/80 hover:bg-white/90 text-gray-800 backdrop-blur-sm transition-all duration-200 z-10 rounded-full"
      >
        <i className="ri-arrow-left-line text-xl"></i>
      </button>
      
      <button
        onClick={nextSlide}
        className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center bg-white/80 hover:bg-white/90 text-gray-800 backdrop-blur-sm transition-all duration-200 z-10 rounded-full"
      >
        <i className="ri-arrow-right-line text-xl"></i>
      </button>

      {/* 指示點 */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex space-x-3 z-10">
        {heroSlides.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`w-3 h-3 rounded-full transition-all duration-200 ${
              index === currentSlide
                ? 'bg-white w-8'
                : 'bg-white/60 hover:bg-white/80'
            }`}
          />
        ))}
      </div>
    </section>
  );
}
