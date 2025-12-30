
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';

export default function Admin() {
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
      <Header />
      
      <main className="page-content">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-sm border p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">
              管理員面板
            </h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* 產品管理 */}
              <div className="bg-blue-50 p-6 rounded-lg">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                    <i className="ri-shopping-bag-line text-xl text-blue-600"></i>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">產品管理</h2>
                </div>
                <p className="text-gray-600 mb-4">管理商品資訊、庫存和價格</p>
                <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">
                  進入管理
                </button>
              </div>

              {/* 訂單管理 */}
              <div className="bg-green-50 p-6 rounded-lg">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                    <i className="ri-file-list-line text-xl text-green-600"></i>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">訂單管理</h2>
                </div>
                <p className="text-gray-600 mb-4">處理訂單狀態和物流追蹤</p>
                <button className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors">
                  進入管理
                </button>
              </div>

              {/* 用戶管理 */}
              <div className="bg-purple-50 p-6 rounded-lg">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
                    <i className="ri-user-line text-xl text-purple-600"></i>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">用戶管理</h2>
                </div>
                <p className="text-gray-600 mb-4">管理用戶帳戶和權限設定</p>
                <button className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors">
                  進入管理
                </button>
              </div>

              {/* 數據分析 */}
              <div className="bg-orange-50 p-6 rounded-lg">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mr-4">
                    <i className="ri-bar-chart-line text-xl text-orange-600"></i>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">數據分析</h2>
                </div>
                <p className="text-gray-600 mb-4">查看銷售數據和用戶行為分析</p>
                <button className="w-full bg-orange-600 text-white py-2 px-4 rounded-lg hover:bg-orange-700 transition-colors">
                  進入管理
                </button>
              </div>

              {/* 內容管理 */}
              <div className="bg-red-50 p-6 rounded-lg">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mr-4">
                    <i className="ri-edit-line text-xl text-red-600"></i>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">內容管理</h2>
                </div>
                <p className="text-gray-600 mb-4">編輯網站內容和促銷活動</p>
                <button className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors">
                  進入管理
                </button>
              </div>

              {/* 系統設定 */}
              <div className="bg-gray-50 p-6 rounded-lg">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mr-4">
                    <i className="ri-settings-line text-xl text-gray-600"></i>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">系統設定</h2>
                </div>
                <p className="text-gray-600 mb-4">配置系統參數和安全設定</p>
                <button className="w-full bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors">
                  進入管理
                </button>
              </div>
            </div>

            {/* 快速統計 */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-600">1,234</div>
                <div className="text-sm text-gray-600">總訂單數</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">567</div>
                <div className="text-sm text-gray-600">活躍用戶</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-purple-600">89</div>
                <div className="text-sm text-gray-600">商品數量</div>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-orange-600">₩2,345,678</div>
                <div className="text-sm text-gray-600">本月營收</div>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
