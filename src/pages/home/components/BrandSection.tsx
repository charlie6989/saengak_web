
import Button from '../../../components/base/Button';

export default function BrandSection() {
  return (
    <>
      <section className="relative h-[600px] md:h-[500px] overflow-hidden">
        {/* 背景圖片 */}
        <div className="absolute inset-0">
          <img
            src="https://hlbhc.cafe24.com/web/upload/NNEditor/se/2500x1000_pc_01.jpg"
            alt="優質女性護理"
            className="hidden md:block w-full h-full object-cover object-center"
          />
          <img
            src="https://hlbhc.cafe24.com/web/upload/NNEditor/se/1000x1250_mobile_01.jpg"
            alt="優質女性護理"
            className="md:hidden w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-black/20"></div>
        </div>

        {/* 內容 */}
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-white" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
              頂級女性護理
            </h2>
            <p className="text-lg md:text-xl lg:text-2xl mb-10 max-w-2xl mx-auto leading-relaxed text-white" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
              內心想法制定私密護理的標準，<br />
              並承諾提供符合標準的安全護理。
            </p>
            <a
              href="/products"
              className="view-all-btn"
              style={{ fontFamily: "Noto Sans TC, sans-serif" }}
            >
              查看所有產品
            </a>
          </div>
        </div>
      </section>
    </>
  );
}