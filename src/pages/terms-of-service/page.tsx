
import React from 'react';
import { Link } from 'react-router-dom';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FFFEF2', paddingTop: '90px' }}>
      {/* 頁面標題區域 */}
      <div className="bg-gradient-to-r from-teal-50 to-blue-50 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
            網路訂購商品條款
          </h1>
          <p className="text-xl text-gray-600" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
            請詳細閱讀以下條款，使用本網站即表示您同意遵守相關規定
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* 最後更新時間 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
          <p className="text-blue-800 text-sm" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
            <i className="ri-calendar-line mr-2"></i>
            最後更新時間：2024年1月1日
          </p>
        </div>

        {/* 條款內容 */}
        <div className="space-y-8">
          {/* 第一條：總則 */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
              <span className="bg-teal-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm mr-3">1</span>
              總則
            </h2>
            
            <div className="space-y-4 text-gray-700" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
              <p className="leading-relaxed">
                本條款適用於您在 LUCISSI CARE官方網站（以下簡稱「本網站」）進行的所有網路購物行為。當您使用本網站服務或完成訂購時，即表示您已閱讀、瞭解並同意接受本條款的所有內容。
              </p>
              <p className="leading-relaxed">
                本公司保留隨時修改本條款的權利，修改後的條款將公佈於網站上，恕不另行通知。建議您定期查閱本條款內容。
              </p>
            </div>
          </section>

          {/* 第二條：商品資訊 */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
              <span className="bg-teal-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm mr-3">2</span>
              商品資訊與價格
            </h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                  商品描述
                </h3>
                <ul className="space-y-2 text-gray-700" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                  <li className="flex items-start">
                    <i className="ri-check-line text-teal-600 mr-2 mt-1"></i>
                    網站上的商品圖片、規格、功能說明僅供參考
                  </li>
                  <li className="flex items-start">
                    <i className="ri-check-line text-teal-600 mr-2 mt-1"></i>
                    實際商品以收到的實體商品為準
                  </li>
                  <li className="flex items-start">
                    <i className="ri-check-line text-teal-600 mr-2 mt-1"></i>
                    因拍攝光線、螢幕設定等因素，商品顏色可能略有差異
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                  價格政策
                </h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-700" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                    網站上顯示的價格均為新台幣含稅價格。本公司保留調整商品價格的權利，但已確認的訂單不受影響。如遇價格標示錯誤，本公司有權取消該筆訂單。
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* 第三條：訂購流程 */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
              <span className="bg-teal-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm mr-3">3</span>
              訂購流程與確認
            </h2>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-teal-50 rounded-lg p-4 text-center">
                  <div className="w-12 h-12 bg-teal-600 text-white rounded-full flex items-center justify-center mx-auto mb-3">
                    <i className="ri-shopping-cart-line"></i>
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                    選購商品
                  </h4>
                  <p className="text-sm text-gray-600" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                    瀏覽並選擇商品加入購物車
                  </p>
                </div>
                <div className="bg-teal-50 rounded-lg p-4 text-center">
                  <div className="w-12 h-12 bg-teal-600 text-white rounded-full flex items-center justify-center mx-auto mb-3">
                    <i className="ri-file-list-line"></i>
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                    填寫資料
                  </h4>
                  <p className="text-sm text-gray-600" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                    填寫收件人及付款資訊
                  </p>
                </div>
                <div className="bg-teal-50 rounded-lg p-4 text-center">
                  <div className="w-12 h-12 bg-teal-600 text-white rounded-full flex items-center justify-center mx-auto mb-3">
                    <i className="ri-secure-payment-line"></i>
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                    完成付款
                  </h4>
                  <p className="text-sm text-gray-600" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                    選擇付款方式並完成付款
                  </p>
                </div>
                <div className="bg-teal-50 rounded-lg p-4 text-center">
                  <div className="w-12 h-12 bg-teal-600 text-white rounded-full flex items-center justify-center mx-auto mb-3">
                    <i className="ri-mail-check-line"></i>
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                    訂單確認
                  </h4>
                  <p className="text-sm text-gray-600" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                    收到訂單確認通知
                  </p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-amber-800" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                  <i className="ri-information-line mr-2"></i>
                  <strong>重要提醒：</strong>訂單成立後，如需修改或取消，請立即聯繫客服。商品出貨後恕無法修改訂單內容。
                </p>
              </div>
            </div>
          </section>

          {/* 第四條：付款方式 */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
              <span className="bg-teal-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm mr-3">4</span>
              付款方式與安全
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                  接受的付款方式
                </h3>
                <ul className="space-y-3">
                  <li className="flex items-center text-gray-700" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                    <i className="ri-bank-card-line text-teal-600 mr-3"></i>
                    信用卡（Visa、MasterCard、JCB）
                  </li>
                  <li className="flex items-center text-gray-700" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                    <i className="ri-bank-line text-teal-600 mr-3"></i>
                    ATM轉帳
                  </li>
                  <li className="flex items-center text-gray-700" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                    <i className="ri-store-line text-teal-600 mr-3"></i>
                    超商代碼繳費
                  </li>
                  <li className="flex items-center text-gray-700" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                    <i className="ri-truck-line text-teal-600 mr-3"></i>
                    貨到付款
                  </li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                  付款安全保障
                </h3>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <ul className="space-y-2 text-green-800" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                    <li className="flex items-start">
                      <i className="ri-shield-check-line mr-2 mt-1"></i>
                      SSL安全加密傳輸
                    </li>
                    <li className="flex items-start">
                      <i className="ri-shield-check-line mr-2 mt-1"></i>
                      不儲存信用卡資訊
                    </li>
                    <li className="flex items-start">
                      <i className="ri-shield-check-line mr-2 mt-1"></i>
                      第三方金流服務保障
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* 第五條：配送服務 */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
              <span className="bg-teal-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm mr-3">5</span>
              配送服務
            </h2>
            
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                    標準配送
                  </h4>
                  <p className="text-sm text-gray-600 mb-2" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                    1-2個工作日出貨
                  </p>
                  <p className="text-sm text-gray-600" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                    運費：滿$800免運，未滿收取$60
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                    快速配送
                  </h4>
                  <p className="text-sm text-gray-600 mb-2" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                    當日或隔日到貨
                  </p>
                  <p className="text-sm text-gray-600" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                    運費：$120（限台北市、新北市）
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                    超商取貨
                  </h4>
                  <p className="text-sm text-gray-600 mb-2" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                    2-3個工作日到店
                  </p>
                  <p className="text-sm text-gray-600" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                    運費：$60（可貨到付款）
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                  配送注意事項
                </h4>
                <ul className="space-y-1 text-blue-800 text-sm" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                  <li>• 週末及國定假日不出貨，配送時間順延</li>
                  <li>• 偏遠地區可能需要額外1-2個工作日</li>
                  <li>• 收件人需年滿18歲或有成年人代收</li>
                  <li>• 請確保收件地址正確，錯誤地址產生的額外費用由顧客負擔</li>
                </ul>
              </div>
            </div>
          </section>

          {/* 第六條：會員權益 */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
              <span className="bg-teal-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm mr-3">6</span>
              會員權益與義務
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                  會員權益
                </h3>
                <ul className="space-y-2 text-gray-700" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                  <li className="flex items-start">
                    <i className="ri-gift-line text-teal-600 mr-2 mt-1"></i>
                    生日月專屬9折優惠
                  </li>
                  <li className="flex items-start">
                    <i className="ri-star-line text-teal-600 mr-2 mt-1"></i>
                    積分回饋制度
                  </li>
                  <li className="flex items-start">
                    <i className="ri-truck-line text-teal-600 mr-2 mt-1"></i>
                    會員專屬免運門檻
                  </li>
                  <li className="flex items-start">
                    <i className="ri-notification-line text-teal-600 mr-2 mt-1"></i>
                    新品搶先體驗通知
                  </li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                  會員義務
                </h3>
                <ul className="space-y-2 text-gray-700" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                  <li className="flex items-start">
                    <i className="ri-user-line text-teal-600 mr-2 mt-1"></i>
                    提供真實完整的個人資料
                  </li>
                  <li className="flex items-start">
                    <i className="ri-lock-line text-teal-600 mr-2 mt-1"></i>
                    妥善保管帳號密碼
                  </li>
                  <li className="flex items-start">
                    <i className="ri-refresh-line text-teal-600 mr-2 mt-1"></i>
                    及時更新個人資料
                  </li>
                  <li className="flex items-start">
                    <i className="ri-shield-line text-teal-600 mr-2 mt-1"></i>
                    遵守網站使用規範
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* 第七條：免責聲明 */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
              <span className="bg-teal-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm mr-3">7</span>
              免責聲明
            </h2>
            
            <div className="space-y-4 text-gray-700" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
              <p className="leading-relaxed">
                本公司對於因天災、戰爭、政府法令、駭客攻擊、網路中斷等不可抗力因素導致的服務中斷或延遲，不承擔責任。
              </p>
              <p className="leading-relaxed">
                使用者因個人體質差異或使用方式不當導致的任何問題，本公司不承擔責任。建議使用前詳閱產品說明，如有疑慮請諮詢專業醫師。
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
                  <i className="ri-alert-line mr-2"></i>
                  <strong>特別提醒：</strong>本網站商品僅供成年人購買使用，未成年人需經監護人同意。
                </p>
              </div>
            </div>
          </section>

          {/* 第八條：法律適用 */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
              <span className="bg-teal-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm mr-3">8</span>
              法律適用與爭議處理
            </h2>
            
            <div className="space-y-4 text-gray-700" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
              <p className="leading-relaxed">
                本條款之解釋與適用，以及與本條款有關的爭議，均應依照中華民國法律予以處理，並以台灣台北地方法院為第一審管轄法院。
              </p>
              <p className="leading-relaxed">
                如本條款之任何條文與法律相抵觸時，以法律規定為準，但不影響其他條文的效力。
              </p>
            </div>
          </section>

          {/* 聯繫資訊 */}
          <section className="bg-gradient-to-r from-teal-50 to-blue-50 rounded-lg p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
              有疑問嗎？
            </h2>
            <p className="text-gray-600 mb-6" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
              如對本條款有任何疑問，歡迎聯繫我們的客服團隊
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/customer-service"
                className="inline-flex items-center justify-center px-6 py-3 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition-colors duration-200 whitespace-nowrap"
                style={{ fontFamily: "Noto Sans TC, sans-serif" }}
              >
                <i className="ri-customer-service-2-line mr-2"></i>
                聯繫客服
              </Link>
              <Link
                to="/faq"
                className="inline-flex items-center justify-center px-6 py-3 bg-white text-teal-600 font-medium rounded-lg border border-teal-600 hover:bg-teal-50 transition-colors duration-200 whitespace-nowrap"
                style={{ fontFamily: "Noto Sans TC, sans-serif" }}
              >
                <i className="ri-question-line mr-2"></i>
                常見問題
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
