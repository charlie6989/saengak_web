
import React, { useState } from 'react';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import { siteConfig } from '../../content/site';

interface OrderStatus {
  id: string;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  date: string;
  description: string;
}

interface Order {
  id: string;
  orderNumber: string;
  date: string;
  total: number;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  items: Array<{
    id: string;
    name: string;
    image: string;
    price: number;
    quantity: number;
  }>;
  shipping: {
    method: string;
    address: string;
    trackingNumber?: string;
  };
  statusHistory: OrderStatus[];
}

export default function OrderStatusPage() {
  const [searchType, setSearchType] = useState<'order' | 'email'>('order');
  const [searchValue, setSearchValue] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Mock order data
  const mockOrders: Order[] = [
    {
      id: '1',
      orderNumber: 'ORD-2024-001234',
      date: '2024-12-15',
      total: 2580,
      status: 'shipped',
      items: [
        {
          id: '1',
          name: '保濕精華液 30ml',
          image: 'https://readdy.ai/api/search-image?query=Luxury%20skincare%20serum%20bottle%20with%20elegant%20packaging%2C%20premium%20cosmetic%20product%20photography%2C%20clean%20white%20background%2C%20professional%20lighting&width=200&height=200&seq=serum-1&orientation=squarish',
          price: 1280,
          quantity: 1
        },
        {
          id: '2',
          name: '抗老面霜 50ml',
          image: 'https://readdy.ai/api/search-image?query=Premium%20anti-aging%20face%20cream%20jar%20with%20sophisticated%20packaging%2C%20luxury%20skincare%20product%2C%20clean%20white%20background%2C%20professional%20product%20photography&width=200&height=200&seq=cream-1&orientation=squarish',
          price: 1300,
          quantity: 1
        }
      ],
      shipping: {
        method: '宅配到府',
        address: siteConfig.companyAddress,
        trackingNumber: 'TW1234567890'
      },
      statusHistory: [
        { id: '1', status: 'pending', date: '2024-12-15 10:30', description: '訂單已建立，等待付款確認' },
        { id: '2', status: 'confirmed', date: '2024-12-15 11:15', description: '付款已確認，開始備貨' },
        { id: '3', status: 'processing', date: '2024-12-16 09:00', description: '商品備貨中' },
        { id: '4', status: 'shipped', date: '2024-12-16 15:30', description: '商品已出貨，配送中' }
      ]
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-50';
      case 'confirmed': return 'text-blue-600 bg-blue-50';
      case 'processing': return 'text-orange-600 bg-orange-50';
      case 'shipped': return 'text-purple-600 bg-purple-50';
      case 'delivered': return 'text-green-600 bg-green-50';
      case 'cancelled': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '待付款';
      case 'confirmed': return '已確認';
      case 'processing': return '備貨中';
      case 'shipped': return '已出貨';
      case 'delivered': return '已送達';
      case 'cancelled': return '已取消';
      default: return '未知狀態';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return 'ri-time-line';
      case 'confirmed': return 'ri-check-line';
      case 'processing': return 'ri-settings-3-line';
      case 'shipped': return 'ri-truck-line';
      case 'delivered': return 'ri-check-double-line';
      case 'cancelled': return 'ri-close-line';
      default: return 'ri-question-line';
    }
  };

  const handleSearch = () => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      if (searchValue === 'ORD-2024-001234' || searchValue === 'user@example.com') {
        setSelectedOrder(mockOrders[0]);
      } else {
        setSelectedOrder(null);
      }
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Noto Sans TC, sans-serif" }}>
      <Header />
      
      {/* Hero Section */}
      <div 
        className="relative pt-32 pb-20 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `linear-gradient(rgba(34, 91, 79, 0.8), rgba(36, 91, 79, 0.8)), url('https://readdy.ai/api/search-image?query=Modern%20logistics%20and%20shipping%20tracking%20system%20with%20packages%20and%20delivery%20trucks%2C%20professional%20business%20environment%2C%20clean%20organized%20warehouse%2C%20efficient%20delivery%20service%20concept&width=1920&height=600&seq=order-status-hero&orientation=landscape')`
        }}
      >
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold text-white mb-6">訂單狀態查詢</h1>
          <p className="text-xl text-white/90 mb-8">輸入訂單編號或電子郵件地址，即時查詢您的訂單狀態</p>
        </div>
      </div>

      <main className="pb-16">
        <div className="max-w-4xl mx-auto px-4">
          {/* Search Section */}
          <div className="bg-white shadow-lg -mt-10 relative z-10 mb-12 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">查詢訂單</h2>
            
            {/* Search Type Toggle */}
            <div className="flex justify-center mb-6">
              <div className="bg-gray-100 p-1 inline-flex">
                <button
                  onClick={() => setSearchType('order')}
                  className={`px-6 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                    searchType === 'order'
                      ? 'bg-teal-600 text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  訂單編號查詢
                </button>
                <button
                  onClick={() => setSearchType('email')}
                  className={`px-6 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                    searchType === 'email'
                      ? 'bg-teal-600 text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  電子郵件查詢
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="max-w-2xl mx-auto">
              <div className="flex gap-4">
                <div className="flex-1">
                  <input
                    type={searchType === 'email' ? 'email' : 'text'}
                    placeholder={searchType === 'order' ? '請輸入訂單編號 (例: ORD-2024-001234)' : '請輸入註冊的電子郵件地址'}
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={!searchValue.trim() || isLoading}
                  className="px-8 py-3 bg-teal-600 text-white font-medium hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  {isLoading ? (
                    <i className="ri-loader-4-line animate-spin"></i>
                  ) : (
                    <>
                      <i className="ri-search-line mr-2"></i>
                      查詢
                    </>
                  )}
                </button>
              </div>
              
              <div className="mt-4 text-sm text-gray-500">
                <p>💡 提示：訂單編號可在確認郵件中找到，格式為 ORD-YYYY-XXXXXX</p>
              </div>
            </div>
          </div>

          {/* Order Details */}
          {selectedOrder && (
            <div className="space-y-8">
              {/* Order Summary */}
              <div className="bg-white border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">訂單詳情</h3>
                    <p className="text-gray-600">訂單編號：{selectedOrder.orderNumber}</p>
                  </div>
                  <div className={`px-4 py-2 font-medium ${getStatusColor(selectedOrder.status)}`}>
                    <i className={`${getStatusIcon(selectedOrder.status)} mr-2`}></i>
                    {getStatusText(selectedOrder.status)}
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6 mb-6">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">訂單日期</h4>
                    <p className="text-gray-600">{selectedOrder.date}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">訂單金額</h4>
                    <p className="text-gray-600">NT$ {selectedOrder.total.toLocaleString()}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">配送方式</h4>
                    <p className="text-gray-600">{selectedOrder.shipping.method}</p>
                  </div>
                </div>

                {selectedOrder.shipping.trackingNumber && (
                  <div className="bg-blue-50 border border-blue-200 p-4">
                    <h4 className="font-semibold text-blue-900 mb-2">物流追蹤</h4>
                    <p className="text-blue-800">追蹤編號：{selectedOrder.shipping.trackingNumber}</p>
                    <button className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium">
                      <i className="ri-external-link-line mr-1"></i>
                      前往物流公司查詢
                    </button>
                  </div>
                )}
              </div>

              {/* Order Items */}
              <div className="bg-white border border-gray-200 p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">訂單商品</h3>
                <div className="space-y-4">
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="flex items-center space-x-4 p-4 border border-gray-100">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-16 h-16 object-cover"
                      />
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{item.name}</h4>
                        <p className="text-gray-600">數量：{item.quantity}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">NT$ {item.price.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status Timeline */}
              <div className="bg-white border border-gray-200 p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-6">訂單狀態追蹤</h3>
                <div className="space-y-4">
                  {selectedOrder.statusHistory.map((status, index) => (
                    <div key={status.id} className="flex items-start space-x-4">
                      <div className={`w-10 h-10 flex items-center justify-center ${getStatusColor(status.status)}`}>
                        <i className={`${getStatusIcon(status.status)} text-lg`}></i>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-gray-900">{getStatusText(status.status)}</h4>
                          <span className="text-sm text-gray-500">{status.date}</span>
                        </div>
                        <p className="text-gray-600 text-sm mt-1">{status.description}</p>
                      </div>
                      {index < selectedOrder.statusHistory.length - 1 && (
                        <div className="absolute left-5 mt-10 w-0.5 h-8 bg-gray-200"></div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Shipping Address */}
              <div className="bg-white border border-gray-200 p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">配送地址</h3>
                <p className="text-gray-700">{selectedOrder.shipping.address}</p>
              </div>
            </div>
          )}

          {/* No Results */}
          {searchValue && !selectedOrder && !isLoading && (
            <div className="text-center py-12">
              <i className="ri-search-line text-6xl text-gray-300 mb-4"></i>
              <h3 className="text-xl font-semibold text-gray-500 mb-2">找不到相關訂單</h3>
              <p className="text-gray-400 mb-6">請檢查訂單編號或電子郵件地址是否正確</p>
              <div className="bg-yellow-50 border border-yellow-200 p-4 max-w-md mx-auto">
                <p className="text-yellow-800 text-sm">
                  如果仍無法找到訂單，請聯絡客服：<br />
                  電話：{siteConfig.servicePhone}<br />
                  信箱：{siteConfig.supportEmail}
                </p>
              </div>
            </div>
          )}

          {/* Help Section */}
          <div className="mt-16 bg-gray-50 p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">需要協助？</h2>
              <p className="text-gray-600">我們的客服團隊隨時為您提供訂單相關協助</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white p-6 text-center">
                <i className="ri-phone-line text-3xl text-teal-600 mb-4"></i>
                <h3 className="font-semibold text-gray-900 mb-2">電話客服</h3>
                <p className="text-gray-600 text-sm mb-4">{siteConfig.serviceHours}</p>
                <p className="font-semibold text-teal-600">{siteConfig.servicePhone}</p>
              </div>
              
              <div className="bg-white p-6 text-center">
                <i className="ri-mail-line text-3xl text-blue-600 mb-4"></i>
                <h3 className="font-semibold text-gray-900 mb-2">電子郵件</h3>
                <p className="text-gray-600 text-sm mb-4">24小時內回覆</p>
                <p className="font-semibold text-blue-600">{siteConfig.supportEmail}</p>
              </div>
              
              <div className="bg-white p-6 text-center">
                <i className="ri-customer-service-2-line text-3xl text-green-600 mb-4"></i>
                <h3 className="font-semibold text-gray-900 mb-2">線上客服</h3>
                <p className="text-gray-600 text-sm mb-4">即時線上協助</p>
                <button className="bg-green-600 text-white px-4 py-2 hover:bg-green-700 transition-colors text-sm whitespace-nowrap">
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
