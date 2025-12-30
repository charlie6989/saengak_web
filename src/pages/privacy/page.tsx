
import { useState } from 'react';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';

export default function Privacy() {
  const [openSections, setOpenSections] = useState<{ [key: string]: boolean }>({});

  const toggleSection = (sectionId: string) => {
    setOpenSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const privacySections = [
    {
      id: 'scope',
      title: '1. 本隱私權政策之適用範圍',
      content: (
        <div className="space-y-4">
          <p>「本政策」適用於所有 LUCISSI 的品牌及其子公司或關係企業。</p>
          <p>您必須年滿十八(18)歲才能在「本網站」提供您的個人資料。若您未滿十八(18)歲，您必須取得您的父母/法定代理人之同意。您的父母/法定代理人必須閱讀並了解「本網站」所有內容並同意您在「本網站」提供個人資料。我們不會故意蒐集十八(18)歲以下個人之資料。</p>
          <p>當您繼續使用「本網站」，即代表您無保留的接受並同意「本政策」之所有內容。LUCISSI 保留為因應法規變更及其他因素而隨時修改「本政策」內容之權利，基此，您每次進入或使用「本網站」時，請重新檢視「本政策」以了解變更及修改內容。</p>
        </div>
      )
    },
    {
      id: 'commitment',
      title: '2. 我們的隱私承諾',
      content: (
        <div className="space-y-4">
          <ul className="space-y-3">
            <li className="flex items-start">
              <i className="ri-check-line text-teal-600 mr-3 mt-1 flex-shrink-0"></i>
              <span>我們尊重您的隱私權及您的選擇</span>
            </li>
            <li className="flex items-start">
              <i className="ri-check-line text-teal-600 mr-3 mt-1 flex-shrink-0"></i>
              <span>我們確保將隱私及安全內建於我們所從事的活動中</span>
            </li>
            <li className="flex items-start">
              <i className="ri-check-line text-teal-600 mr-3 mt-1 flex-shrink-0"></i>
              <span>未經您的同意，我們不會寄發行銷訊息；且您得隨時改變您的決定</span>
            </li>
            <li className="flex items-start">
              <i className="ri-check-line text-teal-600 mr-3 mt-1 flex-shrink-0"></i>
              <span>我們絕不出售您的資料</span>
            </li>
            <li className="flex items-start">
              <i className="ri-check-line text-teal-600 mr-3 mt-1 flex-shrink-0"></i>
              <span>我們承諾維護您的資料安全，包括只選擇與可信賴的夥伴共事</span>
            </li>
            <li className="flex items-start">
              <i className="ri-check-line text-teal-600 mr-3 mt-1 flex-shrink-0"></i>
              <span>我們承諾以開放及透明的態度說明如何使用您的資料</span>
            </li>
            <li className="flex items-start">
              <i className="ri-check-line text-teal-600 mr-3 mt-1 flex-shrink-0"></i>
              <span>我們不會以未告知您的方法使用您的資料</span>
            </li>
            <li className="flex items-start">
              <i className="ri-check-line text-teal-600 mr-3 mt-1 flex-shrink-0"></i>
              <span>我們尊重您的權利，且會在符合法律及我們的維運責任下，盡可能配合您的要求</span>
            </li>
          </ul>
          <p className="mt-6 text-gray-600">
            如您對於個人資料有任何疑問或顧慮，請透過以下方式與我們聯繫：0800-123-456。
          </p>
        </div>
      )
    },
    {
      id: 'background',
      title: '3. 我們的背景',
      content: (
        <div className="space-y-4">
          <p>LUCISSI 為台灣領先的美妝保養品牌。LUCISSI 負責蒐集、處理、利用並管理您與我們分享的個人資料。本政策所指「LUCISSI」、「我們」或「我們的」，即指 LUCISSI 品牌。如應適用之個人資料保護相關法規訂定有資料控管者時，LUCISSI 即為個人資料之控管者。</p>
          <p>如欲查詢我們的聯絡方式，請見「聯絡」部分。</p>
          <p>LUCISSI 代表多個不同品牌及產品，致力於為消費者提供優質的美妝保養體驗。</p>
        </div>
      )
    },
    {
      id: 'personal-data',
      title: '4. 何謂個人資料？',
      content: (
        <div className="space-y-4">
          <p>「個人資料」係指任何得以直接（例如您的姓名）或間接（例如透過獨特編號等經過假名化處理的資料）識別您身分的單一或多個資料。</p>
          <p>個人資料包括：</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>電郵/住所地址、行動電話號碼</li>
            <li>使用者名稱、個人檔案頭像</li>
            <li>個人偏好及購物習慣</li>
            <li>用戶內容、財務及福利資訊</li>
            <li>身體狀況等</li>
            <li>特殊辨識碼，例如您的IP位址或您行動裝置的MAC位址</li>
            <li>Cookies 等追蹤技術</li>
          </ul>
        </div>
      )
    },
    {
      id: 'data-collection',
      title: '5. 我們如何蒐集或使用您的個人資料？',
      content: (
        <div className="space-y-6">
          <p>我們歡迎您親臨我們的專櫃及瀏覽我們的網站。我們可能透過我們的網站、表格、應用程式、裝置、社群媒體上的品牌頁面或 LUCISSI 產品等，蒐集或接收您的資料。</p>
          
          <div className="bg-teal-50 rounded-lg p-6">
            <h4 className="font-semibold text-gray-900 mb-4">資料蒐集方式：</h4>
            <ul className="space-y-2">
              <li className="flex items-start">
                <i className="ri-user-line text-teal-600 mr-3 mt-1"></i>
                <span><strong>直接提供：</strong>您建立帳號、與我們聯繫、購買產品時</span>
              </li>
              <li className="flex items-start">
                <i className="ri-global-line text-teal-600 mr-3 mt-1"></i>
                <span><strong>自動蒐集：</strong>啟用 Cookies 了解您如何使用我們的網站/應用程式</span>
              </li>
              <li className="flex items-start">
                <i className="ri-share-line text-teal-600 mr-3 mt-1"></i>
                <span><strong>第三方來源：</strong>從其他第三方（包括關係企業）接收您的資料</span>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900">必填欄位說明：</h4>
            <p>當我們蒐集資料時，我們會以星號(*)標示必填欄位，此係為了以下目的所需：</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>為了履行我們與您的合約（例如為了運送您購買之產品）</li>
              <li>向您提供您所要求之服務（例如提供您所訂閱之電子報）</li>
              <li>遵守法律規範（例如開立發票）</li>
            </ul>
            <p className="text-amber-600 font-medium">如您不提供以星號(*)標示欄位之資料，可能會使我們無法向您提供產品及服務。</p>
          </div>
        </div>
      )
    },
    {
      id: 'data-usage',
      title: '6. 關於您與我們的互動以及其對您的資料構成之影響',
      content: (
        <div className="space-y-6">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300 text-sm">
              <thead>
                <tr className="bg-teal-50">
                  <th className="border border-gray-300 p-3 text-left font-semibold">互動類型</th>
                  <th className="border border-gray-300 p-3 text-left font-semibold">蒐集的個人資料</th>
                  <th className="border border-gray-300 p-3 text-left font-semibold">使用目的</th>
                  <th className="border border-gray-300 p-3 text-left font-semibold">法律基礎</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 p-3 font-medium">建立及管理帳號</td>
                  <td className="border border-gray-300 p-3">姓名、性別、電郵地址、郵寄地址、電話號碼、照片、生日、ID、用戶名稱及密碼、個人偏好、訂單明細、社群媒體資料</td>
                  <td className="border border-gray-300 p-3">管理訂單、推廣活動、回覆問題、提供常客計劃、管理個人偏好</td>
                  <td className="border border-gray-300 p-3">履行合約、同意、合法利益</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-300 p-3 font-medium">購物及訂單管理</td>
                  <td className="border border-gray-300 p-3">姓名、電郵地址、郵寄地址、電話號碼、交易資訊、付款狀態、購買紀錄</td>
                  <td className="border border-gray-300 p-3">處理訂單、追蹤配送、管理付款、防範詐騙</td>
                  <td className="border border-gray-300 p-3">履行合約、合法利益</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 p-3 font-medium">線上瀏覽</td>
                  <td className="border border-gray-300 p-3">瀏覽記錄、點擊行為、搜尋記錄、IP位址、瀏覽器資訊、裝置資訊</td>
                  <td className="border border-gray-300 p-3">網站正常運作、安全防護、統計分析、個人化服務</td>
                  <td className="border border-gray-300 p-3">合法利益、同意</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-300 p-3 font-medium">推廣活動</td>
                  <td className="border border-gray-300 p-3">姓名、電郵地址、電話號碼、生日、性別、郵寄地址、個人偏好</td>
                  <td className="border border-gray-300 p-3">管理比賽、遊戲、意見調查、統計分析、行銷訊息</td>
                  <td className="border border-gray-300 p-3">履行合約、合法利益、同意</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )
    },
    {
      id: 'automated-decision',
      title: '7. 自動決策 (Automated Decision Making)',
      content: (
        <div className="space-y-4">
          <p>我們利用第三方提供者的方案，保障透過我們的網站/應用程式/裝置進行的交易免於詐騙或被盜用。詐騙偵測是以簡單比較、聯繫、聚類分析、預計和異常檢測等方法為基礎。</p>
          <div className="bg-amber-50 border-l-4 border-amber-400 p-4">
            <p className="text-amber-800">
              <strong>注意：</strong>由於需要進行自動詐騙偵測，您可能會經歷訂單處理延誤，或在認定詐騙風險時被限制使用某項服務。
            </p>
          </div>
          <p>我們採取一切合理的預防和保障措施，限制存取您的資料。您有權存取我們用以作為決定基礎的資訊。</p>
        </div>
      )
    },
    {
      id: 'profiling',
      title: '8. 個人剖析 (Profiling)',
      content: (
        <div className="space-y-4">
          <p>當我們發送或顯示客製化之訊息或內容時，我們可能會採用「個人剖析」技術，即任何自動處理個人資料的形式，包括利用該等資料評估關於您的相關個人特點。</p>
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">個人剖析用途：</h4>
            <ul className="space-y-1 text-blue-800">
              <li>• 分析或預測您的個人偏好、興趣</li>
              <li>• 評估經濟狀況、行為模式</li>
              <li>• 提供個人化推薦和內容</li>
            </ul>
          </div>
          <p>根據我們的分析，我們將發送或顯示按照您的興趣/需要客製化之訊息及/或內容。您有權反對在特定情況使用您的資料進行「個人剖析」。</p>
        </div>
      )
    },
    {
      id: 'data-access',
      title: '9. 誰可以存取您的個人資料？',
      content: (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-teal-50 rounded-lg p-4">
              <h4 className="font-semibold text-teal-900 mb-3 flex items-center">
                <i className="ri-building-line mr-2"></i>
                內部分享
              </h4>
              <ul className="space-y-2 text-teal-800 text-sm">
                <li>• 集團內部實體</li>
                <li>• 研究及創新部門</li>
                <li>• 旗下品牌之間</li>
              </ul>
            </div>
            
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-3 flex items-center">
                <i className="ri-handshake-line mr-2"></i>
                可靠第三方
              </h4>
              <ul className="space-y-2 text-blue-800 text-sm">
                <li>• 數位及電子商務服務</li>
                <li>• 廣告、行銷代理公司</li>
                <li>• 運送服務提供者</li>
                <li>• 資訊科技服務</li>
                <li>• 支付工具服務供應商</li>
              </ul>
            </div>
          </div>

          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <h4 className="font-semibold text-red-900 mb-2">重要聲明</h4>
            <p className="text-red-800">我們絕不出售您的個人資料。我們僅於取得您的同意後，才會與第三方分享您的個人資料以作直接行銷用途。</p>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900">其他可能披露情況：</h4>
            <ul className="list-disc pl-6 space-y-2">
              <li>業務或資產出售時，向潛在買家披露</li>
              <li>遵守法律義務、執行條款及細則</li>
              <li>保障 LUCISSI、顧客或員工的權利、財產或安全</li>
              <li>已取得您同意的情況</li>
              <li>法律准許的情況</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'data-location',
      title: '10. 我們存置您的個人資料之地區',
      content: (
        <div className="space-y-4">
          <p>我們向您蒐集的資料可能會被傳輸並存置於台灣以外的地點，並由該等地點存取。該等資料亦可能由我們或我們的服務供應商於台灣以外地點工作的員工處理。</p>
          <div className="bg-green-50 rounded-lg p-4">
            <h4 className="font-semibold text-green-900 mb-2 flex items-center">
              <i className="ri-shield-check-line mr-2"></i>
              安全保障措施
            </h4>
            <p className="text-green-800">LUCISSI 以安全且合法的方式將資料傳輸至台灣以外之地點。我們會採取必要步驟，確保第三方遵守本政策所列之承諾，包括審核隱私及保安標準，及/或簽署相關合約。</p>
          </div>
          <p>如欲了解更多資訊，請按照「聯絡」部分與我們聯繫。</p>
        </div>
      )
    },
    {
      id: 'retention-period',
      title: '11. 我們保存您個人資料之期限',
      content: (
        <div className="space-y-4">
          <p>我們保留您個人資料之期限，僅限於我們需要持有該等資料以符合您的需要或遵守我們的法律義務的期間。</p>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-3">保存期限準則：</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start">
                  <i className="ri-shopping-cart-line text-teal-600 mr-2 mt-1 flex-shrink-0"></i>
                  <span><strong>購買產品：</strong>契約關係期間</span>
                </li>
                <li className="flex items-start">
                  <i className="ri-gift-line text-teal-600 mr-2 mt-1 flex-shrink-0"></i>
                  <span><strong>推廣活動：</strong>活動期間</span>
                </li>
                <li className="flex items-start">
                  <i className="ri-question-line text-teal-600 mr-2 mt-1 flex-shrink-0"></i>
                  <span><strong>查詢服務：</strong>處理問題必要期間</span>
                </li>
                <li className="flex items-start">
                  <i className="ri-user-line text-teal-600 mr-2 mt-1 flex-shrink-0"></i>
                  <span><strong>帳戶資料：</strong>直至您要求刪除</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-3">特殊保存情況：</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start">
                  <i className="ri-mail-line text-blue-600 mr-2 mt-1 flex-shrink-0"></i>
                  <span><strong>行銷訊息：</strong>直至取消訂閱</span>
                </li>
                <li className="flex items-start">
                  <i className="ri-global-line text-blue-600 mr-2 mt-1 flex-shrink-0"></i>
                  <span><strong>Cookies：</strong>必要期間及法規期限</span>
                </li>
                <li className="flex items-start">
                  <i className="ri-file-text-line text-blue-600 mr-2 mt-1 flex-shrink-0"></i>
                  <span><strong>法律要求：</strong>遵循法規義務</span>
                </li>
                <li className="flex items-start">
                  <i className="ri-bar-chart-line text-blue-600 mr-2 mt-1 flex-shrink-0"></i>
                  <span><strong>統計資料：</strong>匿名處理保存</span>
                </li>
              </ul>
            </div>
          </div>
          
          <p className="text-gray-600">當我們不再需要使用您的個人資料，該等資料將從我們的系統和記錄移除或以匿名方式處理，從而使您不會再從中被辨識。</p>
        </div>
      )
    },
    {
      id: 'data-security',
      title: '12. 您的個人資料安全嗎？',
      content: (
        <div className="space-y-4">
          <p>我們致力保障您的個人資料之安全，並為此採取一切合理預防措施。我們亦以合約要求為我們處理您個人資料的可靠第三方遵守本政策之守則。</p>
          
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <i className="ri-lock-line text-3xl text-green-600 mb-2"></i>
              <h4 className="font-semibold text-green-900 mb-2">加密保護</h4>
              <p className="text-green-800 text-sm">採用嚴謹程序和保安措施防止未經授權存取</p>
            </div>
            
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <i className="ri-shield-check-line text-3xl text-blue-600 mb-2"></i>
              <h4 className="font-semibold text-blue-900 mb-2">合約保障</h4>
              <p className="text-blue-800 text-sm">要求第三方遵守隱私政策守則</p>
            </div>
            
            <div className="bg-purple-50 rounded-lg p-4 text-center">
              <i className="ri-eye-line text-3xl text-purple-600 mb-2"></i>
              <h4 className="font-semibold text-purple-900 mb-2">持續監控</h4>
              <p className="text-purple-800 text-sm">定期檢視和更新安全措施</p>
            </div>
          </div>
          
          <div className="bg-amber-50 border-l-4 border-amber-400 p-4">
            <p className="text-amber-800">
              <strong>重要提醒：</strong>由於透過網路傳送資料並非絕對安全，我們無法保證您傳送至我們網站的資料絕對安全。如您發現任何違反資訊安全之情形，請立即通知我們。
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'third-party-links',
      title: '13. 第三方網站連結及社群媒體登入',
      content: (
        <div className="space-y-4">
          <p>我們的網站和應用程式可能會包含可以來往我們的合作夥伴網路、廣告商及關係企業網站之連結。如您開啟連結前往任何該等網站，請注意該等網站另有其個別隱私政策。</p>
          
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <h4 className="font-semibold text-yellow-900 mb-2 flex items-center">
              <i className="ri-alert-line mr-2"></i>
              注意事項
            </h4>
            <p className="text-yellow-800">我們對於第三方網站的隱私政策無須且不會負任何義務或法律責任。請於提交任何個人資料至該等網站前務必檢閱各該政策。</p>
          </div>
          
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900">社群媒體登入</h4>
            <p>我們可能會為您提供使用社群媒體登入的管道。請注意，如您使用社群媒體登入，依照您的社群媒體平台設定，您可能會與我們分享您的個人檔案資訊。</p>
            
            <div className="bg-blue-50 rounded-lg p-4">
              <h5 className="font-semibold text-blue-900 mb-2">第三方分析服務</h5>
              <p className="text-blue-800 text-sm">我們可能使用第三方分析服務，這些服務供應商使用 Cookies、網路伺服器紀錄與 web beacons 科技幫助我們分析訪問者如何使用本站。</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'social-media',
      title: '14. 社群媒體及用戶內容',
      content: (
        <div className="space-y-4">
          <p>我們的部分網站和應用程式容許使用者提交其用戶個人產生之內容。</p>
          
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <h4 className="font-semibold text-red-900 mb-2 flex items-center">
              <i className="ri-error-warning-line mr-2"></i>
              重要提醒
            </h4>
            <p className="text-red-800">請謹記，提交至我們的社群媒體平台之任何內容均屬可供公眾閱覽之內容，因此您在提供部分個人資料時，例如財務資訊或地址詳情時，請務必小心謹慎。</p>
          </div>
          
          <p>如您於我們的社群媒體平台張貼個人資料，我們對於其他個別人士採取的任何行動概不負責。我們建議您不要張貼敏感個人資料。</p>
        </div>
      )
    },
    {
      id: 'your-rights',
      title: '15. 您的權利及選擇',
      content: (
        <div className="space-y-6">
          <p>LUCISSI 尊重您的隱私權，故您能夠掌控個人資料至為重要。您擁有以下個人資料當事人之權利：</p>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-teal-50 rounded-lg p-4">
              <h4 className="font-semibold text-teal-900 mb-3 flex items-center">
                <i className="ri-information-line mr-2"></i>
                被告知之權利
              </h4>
              <p className="text-teal-800 text-sm">您有權就我們使用您個人資料之方式，以及您的權利，獲取清晰、透明且易於理解的資訊。</p>
            </div>
            
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-3 flex items-center">
                <i className="ri-search-line mr-2"></i>
                查詢、閱覽權利
              </h4>
              <p className="text-blue-800 text-sm">您有權要求查詢、閱覽由我們持有而與您有關之個人資料，並要求製給複製本。</p>
            </div>
            
            <div className="bg-green-50 rounded-lg p-4">
              <h4 className="font-semibold text-green-900 mb-3 flex items-center">
                <i className="ri-edit-line mr-2"></i>
                補充或更正權利
              </h4>
              <p className="text-green-800 text-sm">如您的個人資料有誤或過時及/或出現缺漏，您有權要求更正及/或補充。</p>
            </div>
            
            <div className="bg-purple-50 rounded-lg p-4">
              <h4 className="font-semibold text-purple-900 mb-3 flex items-center">
                <i className="ri-delete-bin-line mr-2"></i>
                刪除/被遺忘權利
              </h4>
              <p className="text-purple-800 text-sm">在部份情形，您有權要求我們銷毀或刪除您的個人資料。</p>
            </div>
            
            <div className="bg-orange-50 rounded-lg p-4">
              <h4 className="font-semibold text-orange-900 mb-3 flex items-center">
                <i className="ri-mail-unread-line mr-2"></i>
                拒絕直接行銷權利
              </h4>
              <p className="text-orange-800 text-sm">您可隨時取消訂閱我們的行銷訊息或要求從相關清單退出。</p>
            </div>
            
            <div className="bg-pink-50 rounded-lg p-4">
              <h4 className="font-semibold text-pink-900 mb-3 flex items-center">
                <i className="ri-hand-heart-line mr-2"></i>
                撤回同意權利
              </h4>
              <p className="text-pink-800 text-sm">如我們處理您的個人資料係基於您的同意，您可以隨時撤回您的同意。</p>
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
              <i className="ri-settings-line mr-2"></i>
              關閉 Cookies 之權利
            </h4>
            <p className="text-gray-700 text-sm">您有權關閉 Cookies。網頁瀏覽器通常內建預設接受 Cookies，但您可以簡單透過更改您的瀏覽器設定來關閉。但請注意，如您選擇關閉 Cookies，可能使您無法充分使用我們的網站/應用程式。</p>
            <p className="text-gray-600 text-xs mt-2">
              更多有關 Cookies 設定的資訊，請參考：
              <a href="http://www.aboutcookies.org/" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:text-teal-700 underline ml-1">
                http://www.aboutcookies.org/
              </a>
            </p>
          </div>
          
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
            <p className="text-blue-800">
              <strong>身分驗證：</strong>為處理您的要求，我們可能會要求您提供身分證明。
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'contact',
      title: '16. 聯絡我們',
      content: (
        <div className="space-y-6">
          <p>若您對於 LUCISSI 蒐集、處理或利用您的個人資料或「本政策」有任何疑問或顧慮，或希望行使您的個人資料當事人權利，請透過以下方式與我們聯絡：</p>
          
          <div className="bg-teal-50 rounded-lg p-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-teal-900 mb-4 flex items-center">
                  <i className="ri-customer-service-2-line mr-2"></i>
                  客服聯絡方式
                </h4>
                <div className="space-y-3 text-teal-800">
                  <div className="flex items-center">
                    <i className="ri-phone-line mr-3 text-teal-600"></i>
                    <span><strong>客服電話：</strong>0800-123-456</span>
                  </div>
                  <div className="flex items-center">
                    <i className="ri-mail-line mr-3 text-teal-600"></i>
                    <span><strong>電子郵件：</strong>privacy@lucissi.com</span>
                  </div>
                  <div className="flex items-center">
                    <i className="ri-time-line mr-3 text-teal-600"></i>
                    <span><strong>服務時間：</strong>週一至週五 09:00-18:00</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-teal-900 mb-4 flex items-center">
                  <i className="ri-map-pin-line mr-2"></i>
                  公司地址
                </h4>
                <div className="text-teal-800">
                  <p className="flex items-start">
                    <i className="ri-building-line mr-3 text-teal-600 mt-1 flex-shrink-0"></i>
                    <span>
                      台灣台北市信義區信義路五段7號22樓<br />
                      LUCISSI 股份有限公司<br />
                      個人資料管理人員
                    </span>
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-teal-200">
              <button className="bg-teal-600 text-white px-6 py-3 rounded-lg hover:bg-teal-700 transition-colors cursor-pointer whitespace-nowrap flex items-center">
                <i className="ri-customer-service-2-line mr-2"></i>
                立即聯絡客服
              </button>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
      <Header />
      
      {/* Hero Section */}
      <div 
        className="relative pt-32 pb-20 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url('https://readdy.ai/api/search-image?query=Professional%20business%20team%20discussing%20privacy%20policy%20and%20data%20protection%20in%20modern%20office%20environment%20with%20documents%20and%20digital%20security%20elements%2C%20clean%20corporate%20atmosphere%2C%20soft%20lighting%2C%20professional%20photography%20style&width=1920&height=600&seq=privacy-hero-bg&orientation=landscape')`
        }}
      >
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold text-white mb-6">隱私權政策</h1>
          <p className="text-xl text-white/90 mb-4">我們重視您的隱私權，致力於保護您的個人資料安全</p>
          <div className="text-white/80">
            最後更新日期：2024年12月
          </div>
        </div>
      </div>

      <main className="pb-16">
        <div className="max-w-6xl mx-auto px-4">
          {/* Introduction */}
          <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12 -mt-10 relative z-10 mb-12">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-teal-100 rounded-full mb-4">
                <i className="ri-shield-check-line text-2xl text-teal-600"></i>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">我們的隱私承諾</h2>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                「本網站」係由 LUCISSI 股份有限公司所維運。我們立志成為優秀的企業公民，建立更和諧美好的社會。我們十分重視誠信和透明，致力於打造信任和互惠的基礎，與客戶建立穩固持久的關係。
              </p>
            </div>
          </div>

          {/* Privacy Sections */}
          <div className="space-y-4">
            {privacySections.map((section) => (
              <div key={section.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full px-6 py-4 text-left bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
                >
                  <h3 className="text-lg font-semibold text-gray-900">{section.title}</h3>
                  <i className={`ri-arrow-down-s-line text-xl text-gray-500 transition-transform ${
                    openSections[section.id] ? 'rotate-180' : ''
                  }`}></i>
                </button>
                
                {openSections[section.id] && (
                  <div className="px-6 py-6 border-t border-gray-200">
                    <div className="prose prose-lg max-w-none text-gray-700">
                      {section.content}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="mt-12 bg-gradient-to-r from-teal-50 to-green-50 rounded-2xl p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">需要協助？</h2>
              <p className="text-gray-600">如果您對隱私權政策有任何疑問，我們隨時為您提供協助</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg p-6 text-center shadow-sm">
                <i className="ri-phone-line text-3xl text-teal-600 mb-4"></i>
                <h3 className="font-semibold text-gray-900 mb-2">電話諮詢</h3>
                <p className="text-gray-600 text-sm mb-4">週一至週五 09:00-18:00</p>
                <p className="font-semibold text-teal-600">0800-123-456</p>
              </div>
              
              <div className="bg-white rounded-lg p-6 text-center shadow-sm">
                <i className="ri-mail-line text-3xl text-blue-600 mb-4"></i>
                <h3 className="font-semibold text-gray-900 mb-2">電子郵件</h3>
                <p className="text-gray-600 text-sm mb-4">我們會在24小時內回覆</p>
                <p className="font-semibold text-blue-600">privacy@lucissi.com</p>
              </div>
              
              <div className="bg-white rounded-lg p-6 text-center shadow-sm">
                <i className="ri-customer-service-2-line text-3xl text-green-600 mb-4"></i>
                <h3 className="font-semibold text-gray-900 mb-2">線上客服</h3>
                <p className="text-gray-600 text-sm mb-4">即時線上協助</p>
                <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm whitespace-nowrap">
                  開始對話
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
