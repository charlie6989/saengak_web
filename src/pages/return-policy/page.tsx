import { Link } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import { siteContent } from '../../content/site';

const sectionClass = 'rounded-2xl bg-white p-7 shadow-xs';

export default function ReturnPolicyPage() {
  return (
    <div className="min-h-screen bg-stone-50 text-gray-800">
      <Header />
      <main className="mx-auto max-w-4xl px-5 pb-20 pt-36">
        <p className="mb-3 text-sm font-medium tracking-wide text-brand">最後更新：{siteContent.contentReviewedAt}</p>
        <h1 className="mb-5 text-4xl font-bold text-gray-950">退換貨說明</h1>
        <div className="mb-10 rounded-xl border border-gray-200 bg-white p-5 text-gray-800">
          <p className="font-semibold">收到商品的次日起 7 日內可申請退貨</p>
          <p className="mt-2 text-sm leading-6">請來信 {siteContent.companyEmail}，附上訂單編號與要退回的商品，我們會回覆後續的寄回方式。</p>
        </div>

        <div className="space-y-7">
          <section className={sectionClass}>
            <h2 className="text-2xl font-semibold">退貨條件</h2>
            <p className="mt-4 leading-7">網路購物的商品，可在收到商品的次日起 7 日內，以退回商品或書面通知的方式解除契約，不需說明理由。7 日是猶豫期，不是試用期；請保留商品、吊牌、配件、贈品與包裝的完整狀態，並先聯絡客服。</p>
          </section>

          <section className={sectionClass}>
            <h2 className="text-2xl font-semibold">不適用 7 日退貨的商品</h2>
            <p className="mt-4 leading-7">濕巾、凝膠、慕斯、噴霧與包含這些品項的組合，屬於因衛生考量而密封的個人衛生用品。依「通訊交易解除權合理例外情事適用準則」，已拆除衛生密封時不適用 7 日解除權；這類商品的商品頁與購物車都會事先告知。</p>
            <p className="mt-3 leading-7">只拆開運送外箱不算拆除衛生密封。商品有瑕疵、寄錯或缺件時，仍可依法主張權利。內著不在此限，可依上述條件申請退貨。</p>
          </section>

          <section className={sectionClass}>
            <h2 className="text-2xl font-semibold">運費與換貨</h2>
            <p className="mt-4 leading-7">在 7 日內退貨時，退回運費由我們負擔；商品瑕疵、寄錯或缺件時，來回運費由我們負擔。目前不提供直接換貨，如需更換尺寸或款式，請退貨後重新下單。</p>
          </section>

          <section className={sectionClass}>
            <h2 className="text-2xl font-semibold">申請方式</h2>
            <ol className="mt-4 list-decimal space-y-2 pl-6 leading-7">
              <li>收到商品的次日起 7 日內，來信 {siteContent.companyEmail}。</li>
              <li>提供訂單編號與要退回的商品；如有瑕疵，請附上照片。</li>
              <li>客服確認適用條件與退回方式。</li>
              <li>依客服回覆的方式寄回商品，並保留寄件憑證。</li>
              <li>我們收到並檢查商品後，通知退款結果。</li>
            </ol>
            <p className="mt-4 leading-7">退貨寄回地址：{siteContent.registeredAddress}，收件人：{siteContent.legalName}。請先等客服回覆再寄出。{siteContent.supportSafetyNotice}</p>
            <Link to="/customer-service" className="mt-5 inline-flex rounded-md bg-brand px-5 py-3 text-sm font-medium text-white hover:bg-brand">前往客服中心</Link>
          </section>

          <section className={sectionClass}>
            <h2 className="text-2xl font-semibold">退款</h2>
            <p className="mt-4 leading-7">我們會在收到退回商品或解除契約通知的次日起 15 日內辦理退款。信用卡付款退回原付款信用卡，實際入帳時間依發卡銀行作業而定；ATM 轉帳與貨到付款，由客服確認退款帳戶後匯款。已開立的電子發票會依規定作廢或開立折讓。</p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
