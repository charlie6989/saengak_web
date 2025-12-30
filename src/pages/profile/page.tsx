
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { mockUsers, mockOrders, mockFavorites, mockAuthState, simulateApiDelay } from '../../mocks/userData';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone?: string;
  address?: string;
  birth_date?: string;
  gender?: string;
  instagram?: string;
  created_at: string;
  avatar?: string;
}

interface Order {
  id: string;
  order_number: string;
  total_amount: number;
  status: string;
  created_at: string;
  items: OrderItem[];
}

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  price: number;
  image_url?: string;
}

interface Favorite {
  id: string;
  product_id: string;
  product_name: string;
  product_price: number;
  product_image: string;
  created_at: string;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'profile');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    birth_date: '',
    gender: '',
    instagram: '',
    avatar: ''
  });
  const [message, setMessage] = useState('');
  const [useMockData, setUseMockData] = useState(localStorage.getItem('useMockAuth') === 'true');
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const getUser = async () => {
      if (useMockData) {
        // 使用假數據
        const mockUser = localStorage.getItem('mockCurrentUser');
        if (mockUser) {
          const userData = JSON.parse(mockUser);
          setUser(userData);
          await loadMockData(userData.id);
        } else {
          navigate('/login');
        }
      } else {
        // 使用真實 Supabase
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUser(user);
          await loadProfile(user.id);
          await loadOrders(user.id);
        } else {
          navigate('/login');
        }
      }
      setLoading(false);
    };

    getUser();
  }, [navigate, useMockData]);

  // 監聽 URL 參數變化
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['profile', 'orders', 'favorites'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const loadMockData = async (userId: string) => {
    try {
      await simulateApiDelay(500);

      // 載入假用戶資料
      const mockUser = mockUsers.find(u => u.id === userId);
      if (mockUser) {
        setProfile(mockUser);
        setFormData({
          name: mockUser.name || '',
          phone: mockUser.phone || '',
          address: mockUser.address || '',
          birth_date: mockUser.birth_date || '',
          gender: mockUser.gender || '',
          instagram: mockUser.instagram || '',
          avatar: mockUser.avatar || ''
        });
        setAvatarPreview(mockUser.avatar || '');
      }

      // 載入假訂單資料
      const userOrders = mockOrders.filter(order => order.user_id === userId);
      setOrders(userOrders);

      // 載入假收藏資料
      const userFavorites = mockFavorites.filter(fav => fav.user_id === userId);
      setFavorites(userFavorites);
    } catch (error) {
      console.error('載入假數據失敗:', error);
    }
  };

  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (data) {
        setProfile(data);
        setFormData({
          name: data.name || '',
          phone: data.phone || '',
          address: data.address || '',
          birth_date: data.birth_date || '',
          gender: data.gender || '',
          instagram: data.instagram || '',
          avatar: data.avatar || ''
        });
        setAvatarPreview(data.avatar || '');
      }
    } catch (error) {
      console.error('載入個人資料失敗:', error);
    }
  };

  const loadOrders = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            product_name,
            quantity,
            price,
            image_url
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (data) {
        setOrders(data.map(order => ({
          ...order,
          items: order.order_items || []
        })));
      }
    } catch (error) {
      console.error('載入訂單歷史失敗:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleAvatarClick = () => {
    if (isEditing && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 檢查文件大小（限制為 5MB）
      if (file.size > 5 * 1024 * 1024) {
        setMessage('圖片大小不能超過 5MB');
        return;
      }

      // 檢查文件類型
      if (!file.type.startsWith('image/')) {
        setMessage('請選擇圖片文件');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setAvatarPreview(result);
        setFormData({
          ...formData,
          avatar: result
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    try {
      if (useMockData) {
        // 假數據模式
        await simulateApiDelay(1000);

        // 更新 localStorage 中的用戶資料
        const updatedUser = {
          ...user,
          ...formData,
          updated_at: new Date().toISOString()
        };

        localStorage.setItem('mockCurrentUser', JSON.stringify(updatedUser));
        setUser(updatedUser);
        setProfile(updatedUser);

        setMessage('個人資料更新成功！');
        setIsEditing(false);
      } else {
        // 真實 Supabase 更新
        const { error } = await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            email: user.email,
            ...formData,
            updated_at: new Date().toISOString()
          });

        if (error) {
          setMessage('更新失敗，請稍後再試');
        } else {
          setMessage('個人資料更新成功！');
          setIsEditing(false);
          await loadProfile(user.id);
        }
      }
    } catch (error) {
      setMessage('發生錯誤，請稍後再試');
    }

    setTimeout(() => setMessage(''), 3000);
  };

  const handleLogout = async () => {
    if (useMockData) {
      // 假數據登出
      localStorage.removeItem('mockCurrentUser');
      mockAuthState.isLoggedIn = false;
      mockAuthState.currentUser = null;
    } else {
      // 真實登出
      await supabase.auth.signOut();
    }
    navigate('/');
  };

  const handleRemoveFavorite = async (favoriteId: string) => {
    if (useMockData) {
      // 假數據模式 - 從列表中移除
      setFavorites(favorites.filter(fav => fav.id !== favoriteId));
    } else {
      // 真實 Supabase 操作
      try {
        const { error } = await supabase
          .from('user_favorites')
          .delete()
          .eq('id', favoriteId);

        if (!error) {
          setFavorites(favorites.filter(fav => fav.id !== favoriteId));
        }
      } catch (error) {
        console.error('移除收藏失敗:', error);
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-TW');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'processing': return 'text-blue-600 bg-blue-100';
      case 'shipped': return 'text-purple-600 bg-purple-100';
      case 'cancelled': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return '已完成';
      case 'processing': return '處理中';
      case 'shipped': return '已出貨';
      case 'cancelled': return '已取消';
      default: return '未知狀態';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="pt-32 pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* 頁面標題 */}
          <div className="mb-8">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div
                  className={`w-16 h-16 bg-gray-100 flex items-center justify-center border-2 border-gray-200 overflow-hidden ${isEditing ? 'cursor-pointer hover:bg-gray-200' : ''}`}
                  onClick={handleAvatarClick}
                >
                  {avatarPreview || profile?.avatar ? (
                    <img
                      src={avatarPreview || profile?.avatar}
                      alt="用戶頭像"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <i className="ri-user-line text-2xl text-gray-400"></i>
                  )}
                  {isEditing && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <i className="ri-camera-line text-white text-lg"></i>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">會員中心</h1>
                <p className="text-gray-600 mt-2">
                  歡迎回來，{profile?.name || user?.name || user?.email}
                  {useMockData && <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs">假數據模式</span>}
                </p>
              </div>
            </div>
          </div>

          {/* 標籤切換 */}
          <div className="bg-white shadow-sm mb-6">
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm cursor-pointer whitespace-nowrap ${activeTab === 'profile'
                      ? 'border-teal-500 text-teal-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                  <i className="ri-user-line mr-2"></i>
                  個人資料
                </button>
                <button
                  onClick={() => setActiveTab('orders')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm cursor-pointer whitespace-nowrap ${activeTab === 'orders'
                      ? 'border-teal-500 text-teal-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                  <i className="ri-shopping-bag-line mr-2"></i>
                  訂單歷史 ({orders.length})
                </button>
                <button
                  onClick={() => setActiveTab('favorites')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm cursor-pointer whitespace-nowrap ${activeTab === 'favorites'
                      ? 'border-teal-500 text-teal-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                  <i className="ri-heart-line mr-2"></i>
                  我的收藏 ({favorites.length})
                </button>
              </nav>
            </div>
          </div>

          {/* 個人資料標籤 */}
          {activeTab === 'profile' && (
            <div className="bg-white shadow-sm p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">個人資料</h2>
                <div className="space-x-3">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => setIsEditing(false)}
                        className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer whitespace-nowrap"
                      >
                        取消
                      </button>
                      <button
                        onClick={handleSaveProfile}
                        className="px-4 py-2 bg-teal-600 text-white hover:bg-teal-700 cursor-pointer whitespace-nowrap"
                      >
                        儲存
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-4 py-2 bg-teal-600 text-white hover:bg-teal-700 cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-edit-line mr-2"></i>
                      編輯資料
                    </button>
                  )}
                </div>
              </div>

              {message && (
                <div className={`mb-6 p-3 text-sm ${message.includes('成功')
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                  }`}>
                  {message}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    電子郵件
                  </label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 bg-gray-50 text-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    姓名
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border border-gray-300 ${isEditing ? 'focus:outline-none focus:ring-2 focus:ring-teal-500' : 'bg-gray-50'
                      }`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    電話號碼
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border border-gray-300 ${isEditing ? 'focus:outline-none focus:ring-2 focus:ring-teal-500' : 'bg-gray-50'
                      }`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Instagram
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">@</span>
                    <input
                      type="text"
                      name="instagram"
                      value={formData.instagram}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      placeholder="your_username"
                      className={`w-full pl-8 pr-3 py-2 border border-gray-300 ${isEditing ? 'focus:outline-none focus:ring-2 focus:ring-teal-500' : 'bg-gray-50'
                        }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    生日
                  </label>
                  <input
                    type="date"
                    name="birth_date"
                    value={formData.birth_date}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border border-gray-300 ${isEditing ? 'focus:outline-none focus:ring-2 focus:ring-teal-500' : 'bg-gray-50'
                      }`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    性別
                  </label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border border-gray-300 pr-8 ${isEditing ? 'focus:outline-none focus:ring-2 focus:ring-teal-500' : 'bg-gray-50'
                      }`}
                  >
                    <option value="">請選擇</option>
                    <option value="female">女性</option>
                    <option value="male">男性</option>
                    <option value="other">其他</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    地址
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    className={`w-full px-3 py-2 border border-gray-300 ${isEditing ? 'focus:outline-none focus:ring-2 focus:ring-teal-500' : 'bg-gray-50'
                      }`}
                  />
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 border border-red-300 text-red-600 hover:bg-red-50 cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-logout-box-line mr-2"></i>
                  登出
                </button>
              </div>
            </div>
          )}

          {/* 訂單歷史標籤 */}
          {activeTab === 'orders' && (
            <div className="bg-white shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">訂單歷史</h2>

              {orders.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-24 h-24 mx-auto mb-4 bg-gray-100 flex items-center justify-center">
                    <i className="ri-shopping-bag-line text-3xl text-gray-400"></i>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">尚無訂單記錄</h3>
                  <p className="text-gray-500 mb-6">開始購物，建立您的第一筆訂單！</p>
                  <button
                    onClick={() => navigate('/')}
                    className="px-6 py-3 bg-teal-600 text-white hover:bg-teal-700 cursor-pointer whitespace-nowrap"
                  >
                    開始購物
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {orders.map((order) => (
                    <div key={order.id} className="border border-gray-200 p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            訂單編號：{order.order_number}
                          </h3>
                          <p className="text-sm text-gray-500">
                            訂購日期：{formatDate(order.created_at)}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium ${getStatusColor(order.status)}`}>
                            {getStatusText(order.status)}
                          </span>
                          <p className="text-lg font-semibold text-gray-900 mt-1">
                            NT$ {order.total_amount.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {order.items.map((item) => (
                          <div key={item.id} className="flex items-center space-x-4">
                            <div className="w-16 h-16 bg-gray-100 flex items-center justify-center">
                              {item.image_url ? (
                                <img
                                  src={item.image_url}
                                  alt={item.product_name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <i className="ri-image-line text-gray-400"></i>
                              )}
                            </div>
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900">{item.product_name}</h4>
                              <p className="text-sm text-gray-500">
                                數量：{item.quantity} × NT$ {item.price.toLocaleString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 我的收藏標籤 */}
          {activeTab === 'favorites' && (
            <div className="bg-white shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">我的收藏</h2>

              {favorites.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-24 h-24 mx-auto mb-4 bg-gray-100 flex items-center justify-center">
                    <i className="ri-heart-line text-3xl text-gray-400"></i>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">尚無收藏商品</h3>
                  <p className="text-gray-500 mb-6">瀏覽商品時點擊愛心圖示即可收藏</p>
                  <button
                    onClick={() => navigate('/')}
                    className="px-6 py-3 bg-teal-600 text-white hover:bg-teal-700 cursor-pointer whitespace-nowrap"
                  >
                    瀏覽商品
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {favorites.map((favorite) => (
                    <div key={favorite.id} className="border border-gray-200 p-4 hover:shadow-md transition-shadow">
                      <div className="relative">
                        <img
                          src={favorite.product_image}
                          alt={favorite.product_name}
                          className="w-full h-48 object-cover mb-4"
                        />
                        <button
                          onClick={() => handleRemoveFavorite(favorite.id)}
                          className="absolute top-2 right-2 w-8 h-8 bg-white flex items-center justify-center shadow-md hover:bg-red-50 cursor-pointer"
                        >
                          <i className="ri-heart-fill text-red-500"></i>
                        </button>
                      </div>
                      <h3 className="font-medium text-gray-900 mb-2">{favorite.product_name}</h3>
                      <p className="text-lg font-semibold text-teal-600 mb-2">
                        NT$ {favorite.product_price.toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-500 mb-4">
                        收藏於 {formatDate(favorite.created_at)}
                      </p>
                      <button
                        onClick={() => navigate(`/product/${favorite.product_id}`)}
                        className="w-full py-2 bg-teal-600 text-white hover:bg-teal-700 cursor-pointer whitespace-nowrap"
                      >
                        查看商品
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
