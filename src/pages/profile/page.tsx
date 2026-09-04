
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { mockUsers, mockOrders, mockFavorites, mockAuthState, simulateApiDelay } from '../../mocks/userData';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import { safePublicHttpsUrl } from '../../lib/publicUrl';
import { fetchMemberReviews, submitProductReview, isOrderDelivered } from '../../lib/reviews-qa';
import type { ProductReview } from '../../types/reviews-qa';
import { fetchUserCoupons } from '../../lib/promotions';
import type { UserCoupon } from '../../types/promotions';

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
  shipping_method?: string;
  fulfillment_status?: string;
  created_at: string;
  items: OrderItem[];
  fulfillments?: OrderFulfillment[];
  invoices?: OrderInvoice[];
}

interface OrderItem {
  id: string;
  product_id?: string;
  product_name: string;
  quantity: number;
  price: number;
  image_url?: string;
}

interface OrderFulfillment {
  id: string;
  status: string;
  tracking_company?: string;
  tracking_numbers: string[];
  tracking_urls: string[];
}

interface OrderInvoice {
  id: string;
  provider: string;
  status: 'awaiting-provider' | 'issued' | 'voided' | 'allowance-issued' | 'failed';
  invoice_number?: string;
  issued_at?: string;
  voided_at?: string;
  allowance_issued_at?: string;
  allowances?: OrderInvoiceAllowance[];
}

interface OrderInvoiceAllowance {
  id: string;
  allowance_number: string;
  status: 'issued' | 'voided' | 'failed';
  gross_amount: number;
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
  const [memberReviews, setMemberReviews] = useState<ProductReview[]>([]);
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
  const [useMockData, setUseMockData] = useState(
    import.meta.env.DEV && typeof window !== 'undefined' && typeof localStorage !== 'undefined' && localStorage.getItem('useMockAuth') === 'true'
  );
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 評價彈窗狀態
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [activeReviewTarget, setActiveReviewTarget] = useState<{ orderId: string; item: OrderItem } | null>(null);
  const [ratingInput, setRatingInput] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [commentInput, setCommentInput] = useState<string>('');
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);
  const [reviewError, setReviewError] = useState<string>('');
  const [reviewToast, setReviewToast] = useState<string>('');

  // 優惠券狀態
  const [coupons, setCoupons] = useState<UserCoupon[]>([]);
  const [couponFilter, setCouponFilter] = useState<'available' | 'used' | 'expired'>('available');
  const [couponToast, setCouponToast] = useState<string>('');

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
          await Promise.all([
            loadProfile(user.id, user),
            loadOrders(user.id),
            loadFavorites(user.id),
            loadMemberReviews(user.id),
            loadMemberCoupons(user.id),
          ]);
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
    if (tab && ['profile', 'orders', 'favorites', 'coupons'].includes(tab)) {
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

      // 載入評價
      await loadMemberReviews(userId);

      // 載入優惠券
      await loadMemberCoupons(userId);
    } catch (error) {
      console.error('載入假數據失敗:', error);
    }
  };

  const loadMemberCoupons = async (userId: string) => {
    try {
      const userCoupons = await fetchUserCoupons(userId);
      setCoupons(userCoupons);
    } catch (error) {
      console.error('載入會員優惠券失敗:', error);
    }
  };

  const loadMemberReviews = async (userId: string) => {
    try {
      const reviews = await fetchMemberReviews(userId);
      setMemberReviews(reviews || []);
    } catch (error) {
      console.error('載入會員評價失敗:', error);
    }
  };

  const handleOpenReviewModal = (orderId: string, item: OrderItem) => {
    setActiveReviewTarget({ orderId, item });
    setRatingInput(5);
    setHoverRating(0);
    setCommentInput('');
    setReviewError('');
    setIsReviewModalOpen(true);
  };

  const handleCloseReviewModal = () => {
    setIsReviewModalOpen(false);
    setActiveReviewTarget(null);
    setReviewError('');
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeReviewTarget) return;

    if (!commentInput.trim()) {
      setReviewError('請填寫評價心得');
      return;
    }

    setIsSubmittingReview(true);
    setReviewError('');

    try {
      const shopifyProductId = activeReviewTarget.item.product_id || activeReviewTarget.item.id;
      const res = await submitProductReview({
        user_id: user.id,
        order_id: activeReviewTarget.orderId,
        order_item_id: activeReviewTarget.item.id,
        shopify_product_id: shopifyProductId,
        rating: ratingInput,
        comment: commentInput.trim(),
      });

      if (res.error) {
        setReviewError(res.error.message || '評價提交失敗，請稍後再試');
      } else {
        if (res.data) {
          setMemberReviews((prev) => [
            res.data!,
            ...prev.filter((r) => r.order_item_id !== activeReviewTarget.item.id),
          ]);
        }
        handleCloseReviewModal();
        setReviewToast('評價已送出，待管理員審核後發布');
        setTimeout(() => setReviewToast(''), 4000);
      }
    } catch (err: any) {
      setReviewError(err?.message || '評價提交失敗，請稍後再試');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const loadProfile = async (userId: string, authUser = user) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

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
      } else if (authUser) {
        const fallbackProfile = {
          id: userId,
          email: authUser.email || '',
          name: authUser.user_metadata?.name || authUser.user_metadata?.full_name || '',
          created_at: authUser.created_at || new Date().toISOString(),
        };
        setProfile(fallbackProfile);
        setFormData((current) => ({
          ...current,
          name: fallbackProfile.name,
        }));
      }
    } catch (error) {
      console.error('載入個人資料失敗:', error);
      setMessage('個人資料暫時無法載入');
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
            product_id,
            product_name,
            quantity,
            price,
            image_url
          ),
          order_fulfillments (
            id,
            status,
            tracking_company,
            tracking_numbers,
            tracking_urls
          ),
          order_invoices (
            id,
            provider,
            status,
            invoice_number,
            issued_at,
            voided_at,
            allowance_issued_at,
            allowances:order_invoice_allowances (
              id,
              allowance_number,
              status,
              gross_amount
            )
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setOrders(data.map(order => ({
          ...order,
          items: order.order_items || [],
          fulfillments: order.order_fulfillments || [],
          invoices: order.order_invoices || []
        })));
      }
    } catch (error) {
      console.error('載入訂單歷史失敗:', error);
      setMessage('訂單資料暫時無法載入');
    }
  };

  const loadFavorites = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_favorites')
        .select('id, product_id, product_name, product_price, product_image, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFavorites(data || []);
    } catch (error) {
      console.error('載入收藏失敗:', error);
      setMessage('收藏資料暫時無法載入');
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
          console.error('更新個人資料失敗:', error);
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
          setFavorites((current) => current.filter(fav => fav.id !== favoriteId));
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
      case 'paid': return 'text-teal-700 bg-teal-100';
      case 'refunded': return 'text-amber-700 bg-amber-100';
      case 'payment_failed': return 'text-red-600 bg-red-100';
      case 'cancelled': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return '已完成';
      case 'processing': return '處理中';
      case 'shipped': return '已出貨';
      case 'paid': return '已付款';
      case 'refunded': return '已退款';
      case 'payment_failed': return '付款失敗';
      case 'cancelled': return '已取消';
      default: return '未知狀態';
    }
  };

  const getInvoiceStatusText = (status: OrderInvoice['status']) => {
    switch (status) {
      case 'issued': return '已開立';
      case 'voided': return '已作廢';
      case 'allowance-issued': return '已開立折讓';
      case 'failed': return '開立失敗，待人工處理';
      default: return '等待發票供應商回讀';
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
                <button
                  onClick={() => setActiveTab('coupons')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm cursor-pointer whitespace-nowrap ${activeTab === 'coupons'
                      ? 'border-teal-500 text-teal-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                  <i className="ri-coupon-3-line mr-2"></i>
                  我的優惠券 ({coupons.filter((c) => c.status === 'available').length})
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

              {reviewToast && (
                <div
                  data-testid="review-toast"
                  className="mb-6 p-4 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-sm font-medium flex items-center gap-2"
                >
                  <i className="ri-checkbox-circle-line text-emerald-600 text-base"></i>
                  <span>{reviewToast}</span>
                </div>
              )}

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
                        {order.items.map((item) => {
                          const existingReview = memberReviews.find((r) => r.order_item_id === item.id);
                          return (
                            <div
                              key={item.id}
                              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-gray-50/60 rounded-lg border border-gray-100"
                            >
                              <div className="flex items-center space-x-4">
                                <div className="w-16 h-16 bg-gray-100 rounded overflow-hidden flex items-center justify-center flex-shrink-0">
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
                                <div>
                                  <h4 className="font-medium text-gray-900">{item.product_name}</h4>
                                  <p className="text-sm text-gray-500">
                                    數量：{item.quantity} × NT$ {item.price.toLocaleString()}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center self-end sm:self-center">
                                {existingReview ? (
                                  <div
                                    data-testid={`reviewed-badge-${item.id}`}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200/80 rounded-full"
                                  >
                                    <span>
                                      ⭐ 已評價 ({existingReview.status === 'published' ? '已發布' : '審核中'})
                                    </span>
                                    <span className="font-bold text-amber-900">{existingReview.rating}★</span>
                                  </div>
                                ) : isOrderDelivered(order) ? (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenReviewModal(order.id, item)}
                                    data-testid={`write-review-btn-${item.id}`}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#225B4F] bg-white border border-[#225B4F]/40 hover:bg-emerald-50 rounded-md shadow-2xs transition-colors cursor-pointer"
                                  >
                                    <span>✍️</span> 撰寫評價
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {(order.shipping_method || (order.fulfillments?.length ?? 0) > 0) && (
                        <div className="mt-5 border-t border-gray-100 pt-4 text-sm text-gray-700">
                          {order.shipping_method && (
                            <p className="mb-2">
                              <span className="font-medium text-gray-900">配送方式：</span>
                              {order.shipping_method}
                            </p>
                          )}
                          {order.fulfillments?.map((fulfillment) => {
                            const trackingNumber = fulfillment.tracking_numbers?.[0];
                            const trackingUrl = safePublicHttpsUrl(fulfillment.tracking_urls?.[0]);
                            return (
                              <div key={fulfillment.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span>{fulfillment.tracking_company || '物流配送'}</span>
                                {trackingNumber && <span>追蹤碼：{trackingNumber}</span>}
                                {trackingUrl && (
                                  <a
                                    href={trackingUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-medium text-[#225B4F] underline underline-offset-2"
                                  >
                                    查詢配送進度
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="mt-5 border-t border-gray-100 pt-4 text-sm text-gray-700">
                        <p className="font-medium text-gray-900">電子發票</p>
                        {(order.invoices?.length ?? 0) === 0 ? (
                          <p className="mt-1 text-gray-500">
                            尚無發票供應商回讀；發票狀態不會由付款狀態自動推測。
                          </p>
                        ) : (
                          <div className="mt-2 space-y-1">
                            {order.invoices?.map((invoice) => (
                              <div key={invoice.id}>
                                <p>
                                  {getInvoiceStatusText(invoice.status)}
                                  {invoice.invoice_number ? `｜發票號碼 ${invoice.invoice_number}` : ''}
                                </p>
                                {invoice.allowances?.map((allowance) => (
                                  <p key={allowance.id} className="pl-3 text-gray-600">
                                    折讓單 {allowance.allowance_number}
                                    {allowance.status === 'voided' ? '｜已作廢' : '｜已開立'}
                                    {`｜NT$ ${Number(allowance.gross_amount).toLocaleString()}`}
                                  </p>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
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

          {/* 我的優惠券標籤 */}
          {activeTab === 'coupons' && (
            <div className="bg-white shadow-sm p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">我的優惠券</h2>
                  <p className="text-xs sm:text-sm text-gray-500 mt-1">
                    您所領取之專屬折價券均儲存於此，結帳時可直接折抵購物金額。
                  </p>
                </div>
                <Link
                  to="/promotion"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#225B4F] text-white hover:bg-[#1a473e] text-xs sm:text-sm font-semibold rounded-lg shadow-2xs transition-colors self-start sm:self-auto cursor-pointer"
                >
                  <i className="ri-gift-line"></i>
                  <span>前往優惠專區領券</span>
                  <i className="ri-external-link-line text-xs"></i>
                </Link>
              </div>

              {couponToast && (
                <div className="mb-6 p-3 text-sm rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-2">
                  <i className="ri-checkbox-circle-line text-emerald-600"></i>
                  <span>{couponToast}</span>
                </div>
              )}

              {/* 優惠券狀態篩選子頁籤 */}
              <div className="flex border-b border-gray-200 mb-6 gap-2 sm:gap-6">
                <button
                  type="button"
                  onClick={() => setCouponFilter('available')}
                  className={`pb-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                    couponFilter === 'available'
                      ? 'border-[#225B4F] text-[#225B4F]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  可使用 ({coupons.filter((c) => c.status === 'available').length})
                </button>
                <button
                  type="button"
                  onClick={() => setCouponFilter('used')}
                  className={`pb-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                    couponFilter === 'used'
                      ? 'border-[#225B4F] text-[#225B4F]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  已使用 ({coupons.filter((c) => c.status === 'used').length})
                </button>
                <button
                  type="button"
                  onClick={() => setCouponFilter('expired')}
                  className={`pb-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                    couponFilter === 'expired'
                      ? 'border-[#225B4F] text-[#225B4F]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  已過期 ({coupons.filter((c) => c.status === 'expired').length})
                </button>
              </div>

              {/* 列表渲染 */}
              {coupons.filter((c) => c.status === couponFilter).length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                    <i className="ri-coupon-line text-3xl"></i>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    尚無{couponFilter === 'available' ? '可使用' : couponFilter === 'used' ? '已使用' : '已過期'}的優惠券
                  </h3>
                  <p className="text-gray-500 mb-6 text-sm">
                    {couponFilter === 'available'
                      ? '探索最新優惠活動，立即領取專屬折扣碼！'
                      : '此分類目前沒有任何紀錄。'}
                  </p>
                  {couponFilter === 'available' && (
                    <Link
                      to="/promotion"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#225B4F] text-white hover:bg-[#1a473e] text-sm font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
                    >
                      <span>前往優惠專區領券</span>
                      <i className="ri-external-link-line text-sm"></i>
                    </Link>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {coupons
                    .filter((c) => c.status === couponFilter)
                    .map((item) => {
                      const promo = item.promotion;
                      const isAvailable = item.status === 'available';

                      return (
                        <div
                          key={item.id}
                          className={`relative border rounded-2xl p-5 transition-all flex flex-col justify-between ${
                            isAvailable
                              ? 'border-gray-200 bg-white hover:border-[#225B4F]/50 hover:shadow-sm'
                              : 'border-gray-200 bg-gray-50/70 opacity-75'
                          }`}
                        >
                          <div>
                            {/* 頂部標籤與面額 */}
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <div>
                                <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full mb-1.5 ${
                                  isAvailable
                                    ? 'bg-[#225B4F]/10 text-[#225B4F]'
                                    : 'bg-gray-200 text-gray-600'
                                }`}>
                                  {promo?.badge_text || (promo?.discount_type === 'free_shipping' ? '免運券' : '折價券')}
                                </span>
                                <h3 className="font-bold text-gray-900 text-base">
                                  {promo?.title || item.coupon_code}
                                </h3>
                              </div>
                              <div className="text-right">
                                <span className={`text-xl font-black ${isAvailable ? 'text-[#225B4F]' : 'text-gray-500'}`}>
                                  {promo?.discount_type === 'percentage'
                                    ? `${promo.discount_value}% OFF`
                                    : promo?.discount_type === 'fixed_amount'
                                    ? `NT$ ${promo.discount_value}`
                                    : '全館免運'}
                                </span>
                              </div>
                            </div>

                            <p className="text-xs text-gray-600 leading-relaxed mb-4">
                              {promo?.description || (promo?.min_spend ? `全館消費滿 NT$ ${promo.min_spend.toLocaleString()} 即可使用` : '結帳時無條件折抵')}
                            </p>
                          </div>

                          <div className="pt-4 border-t border-gray-100 flex flex-col gap-3">
                            {/* 代碼與複製 */}
                            <div className="flex items-center justify-between bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200/70">
                              <span className="font-mono text-xs font-bold text-gray-700">
                                {item.coupon_code}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (navigator.clipboard) {
                                    navigator.clipboard.writeText(item.coupon_code);
                                    setCouponToast(`已複製優惠碼：${item.coupon_code}`);
                                    setTimeout(() => setCouponToast(''), 3000);
                                  }
                                }}
                                className="text-xs text-[#225B4F] hover:text-[#173e35] font-semibold cursor-pointer"
                              >
                                複製代碼
                              </button>
                            </div>

                            {/* 日期與動作按鈕 */}
                            <div className="flex items-center justify-between pt-1">
                              <span className="text-[11px] text-gray-400">
                                {promo?.ends_at
                                  ? `到期日：${new Date(promo.ends_at).toLocaleDateString('zh-TW')}`
                                  : `領取於 ${new Date(item.claimed_at).toLocaleDateString('zh-TW')}`}
                              </span>

                              {isAvailable ? (
                                <button
                                  type="button"
                                  onClick={() => navigate('/search?query=all')}
                                  className="px-3.5 py-1.5 bg-[#225B4F] hover:bg-[#1a473e] text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
                                >
                                  立即去使用
                                </button>
                              ) : (
                                <span className="text-xs text-gray-400 font-medium">
                                  {item.status === 'used' ? '已於訂單中使用' : '已過期'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 評價互動彈窗 (Review Modal) */}
      {isReviewModalOpen && activeReviewTarget && (
        <div
          data-testid="review-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
        >
          <div
            className="w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <span>✍️</span> 撰寫商品評價
              </h3>
              <button
                type="button"
                onClick={handleCloseReviewModal}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmitReview} className="p-6 space-y-6">
              {/* Product Info Preview */}
              <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl border border-gray-200/70">
                <div className="w-14 h-14 bg-white rounded-lg border border-gray-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {activeReviewTarget.item.image_url ? (
                    <img
                      src={activeReviewTarget.item.image_url}
                      alt={activeReviewTarget.item.product_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <i className="ri-image-line text-gray-400 text-xl"></i>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold text-sm text-gray-900 truncate">
                    {activeReviewTarget.item.product_name}
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    已購數量：{activeReviewTarget.item.quantity} 件
                  </p>
                </div>
              </div>

              {/* Star Rating Selection (1-5 stars with hover and click) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  整體評分 <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2" data-testid="star-rating-selector">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const isFilled = (hoverRating || ratingInput) >= star;
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRatingInput(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        aria-label={`給予 ${star} 顆星`}
                        data-testid={`star-${star}`}
                        className="p-1 text-2xl transition-transform hover:scale-110 focus:outline-none cursor-pointer"
                        style={{ color: isFilled ? '#F59E0B' : '#D1D5DB' }}
                      >
                        <i className={isFilled ? 'ri-star-fill' : 'ri-star-line'}></i>
                      </button>
                    );
                  })}
                  <span className="ml-2 text-xs font-medium text-gray-500">
                    {ratingInput === 5 && '5 星 - 非常滿意'}
                    {ratingInput === 4 && '4 星 - 滿意'}
                    {ratingInput === 3 && '3 星 - 普通'}
                    {ratingInput === 2 && '2 星 - 不滿意'}
                    {ratingInput === 1 && '1 星 - 非常不滿意'}
                  </span>
                </div>
              </div>

              {/* Comment Textarea */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  心得評論 <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="請分享您對此商品的實際穿著體驗、材質觸感或尺寸剪裁感受..."
                  data-testid="review-comment-input"
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-xl focus:border-[#225B4F] focus:ring-1 focus:ring-[#225B4F] focus:outline-none placeholder-gray-400"
                />
                <p className="mt-1 text-xs text-gray-400 text-right">
                  {commentInput.length} 字
                </p>
              </div>

              {/* Error Message */}
              {reviewError && (
                <div
                  data-testid="review-error-message"
                  className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-center gap-1.5"
                >
                  <i className="ri-error-warning-line text-red-500 text-sm"></i>
                  <span>{reviewError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseReviewModal}
                  disabled={isSubmittingReview}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReview || !commentInput.trim()}
                  data-testid="submit-review-button"
                  className="px-5 py-2 text-sm font-medium text-white bg-[#225B4F] hover:bg-[#1a473e] rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmittingReview ? '提交中...' : '送出評價'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
