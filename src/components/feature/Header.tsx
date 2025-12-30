import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import { createClient } from '@supabase/supabase-js';
import { mockUsers, mockAuthState } from '../../mocks/userData';
import AuthModal from './AuthModal';
import SearchOverlay from './SearchOverlay';

const supabase = createClient(
  import.meta.env.VITE_PUBLIC_SUPABASE_URL,
  import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY
);

export default function Header() {
  const [isSearchOverlayOpen, setIsSearchOverlayOpen] = useState(false);
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [user, setUser] = useState<any>(null);
  const [useMockData, setUseMockData] = useState(false);
  const { getTotalItems, setIsCartOpen } = useCart();
  const location = useLocation();
  const navigate = useNavigate();

  // 檢查用戶登入狀態
  useEffect(() => {
    const getUser = async () => {
      // 檢查是否使用假數據模式
      const mockMode = localStorage.getItem('useMockAuth') === 'true';
      setUseMockData(mockMode);

      if (mockMode) {
        // 使用假數據
        const mockUser = localStorage.getItem('mockCurrentUser');
        if (mockUser) {
          const userData = JSON.parse(mockUser);
          setUser(userData);
          mockAuthState.isLoggedIn = true;
          mockAuthState.currentUser = userData;
        }
      } else {
        // 使用真實 Supabase - 添加錯誤處理
        try {
          const { data, error } = await supabase.auth.getUser();
          if (error) {
            // 如果是會話錯誤，不要拋出錯誤，只是設置用戶為 null
            if (error.message.includes('Auth session missing') || error.message.includes('session')) {
              console.log('No active session, user not logged in');
              setUser(null);
            } else {
              console.error('Supabase getUser error:', error);
              setUser(null);
            }
          } else {
            setUser(data.user);
          }
        } catch (err) {
          console.error('Unexpected error while fetching user:', err);
          setUser(null);
        }
      }
    };

    getUser();

    // 若為真實模式則監聽認證狀態變化
    if (!useMockData) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          console.log('Auth state changed:', event, session?.user?.email || 'no user');
          setUser(session?.user || null);
        }
      );
      return () => subscription?.unsubscribe();
    }
  }, [useMockData]);

  // 關閉手機選單
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  const handleAuthClick = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setIsAuthModalOpen(true);
  };

  const handleUserIconClick = () => {
    if (user) {
      setIsUserMenuOpen(!isUserMenuOpen);
    } else {
      navigate('/login');
    }
  };

  const handleLogout = async () => {
    if (useMockData) {
      // 假數據登出
      localStorage.removeItem('mockCurrentUser');
      setUser(null);
      mockAuthState.isLoggedIn = false;
      mockAuthState.currentUser = null;
    } else {
      // 真實登出
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error('Error during sign out:', err);
      }
    }
    setIsUserMenuOpen(false);
    navigate('/');
  };

  const handleCartClick = () => {
    setIsCartOpen(true);
  };

  const handleSearchIconClick = () => {
    setIsSearchOverlayOpen(true);
  };

  const handleProductsClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate('/search?query=all');
  };

  const handleLogoClick = () => {
    navigate('/');
  };

  // 切換假數據模式（開發用）
  const toggleMockMode = () => {
    const newMode = !useMockData;
    localStorage.setItem('useMockAuth', newMode.toString());
    if (!newMode) {
      localStorage.removeItem('mockCurrentUser');
      setUser(null);
    }
    window.location.reload();
  };

  const productCategories = [
    { name: '女性護理', href: '/search?category=女性護理' },
    { name: '每日清潔', href: '/search?category=每日清潔' },
    { name: '深層修護', href: '/search?category=深層修護' },
    { name: '舒適穿著', href: '/search?category=舒適穿著' },
    { name: '益生菌私密舒緩凝膠', href: '/search?category=益生菌私密舒緩凝膠' }
  ];

  return (
    <>
      {/* 頂部橫幅 - 固定在最頂部，固定高度 */}
      <div
        className="fixed top-0 left-0 w-full bg-gray-900 text-white text-center overflow-hidden z-50"
        style={{ height: '32px', fontFamily: "Noto Sans TC, sans-serif" }}
      >
        <div className="animate-marquee whitespace-nowrap flex items-center justify-center h-full text-sm">
          橄欖洋行、新世界百貨江南店、江南產後護理院、藥局入駐！
          {/* 開發模式切換按鈕 */}
          <button
            onClick={toggleMockMode}
            className="ml-8 px-2 py-1 bg-yellow-600 text-white text-xs rounded cursor-pointer"
            title={`當前模式: ${useMockData ? '假數據' : '真實數據'}`}
          >
            {useMockData ? '假數據模式' : '真實模式'}
          </button>
        </div>
      </div>

      {/* 桌面版 - Solid Menu Bar with Conditional Background */}
      <header
        className="hidden lg:block fixed top-0 left-0 w-full z-50 bg-transparent"
        style={{ marginTop: '32px' }}
      >
        <div
          className="view-wrap"
          style={{
            background: 'transparent !important',
            padding: '12px 0.8cm' // 設定左右邊界為 0.8cm
          }}
        >
          {/* 主導航 - 響應式設計，手機版增加高度 */}
          <div
            className="mx-auto w-full"
            style={{
              maxWidth: 'calc(100vw - 1.6cm)', // 扣除左右各 0.8cm 的邊界
              height: 'min(64px, 4.03vw)', // 手機版增加到 64px
              backgroundColor: '#FFFEF2', // 統一設定為 #FFFEF2
              borderRadius: '0px',
              padding: '0 min(20px, 2.22vw)' // 手機版減少內邊距
            }}
          >
            <div className="flex items-center justify-between h-full">
              {/* 左側 - 手機版漢堡選單按鈕 */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden flex items-center justify-center cursor-pointer transition-colors duration-200 hover:text-teal-600 outline-none focus:outline-none border-none bg-transparent"
                style={{
                  width: '48px',
                  height: '48px',
                  border: 'none',
                  background: 'transparent'
                }}
              >
                <i
                  className={isMobileMenuOpen ? "ri-close-line" : "ri-menu-line"}
                  style={{
                    fontSize: '32px',
                    color: '#1F2937'
                  }}
                ></i>
              </button>

              {/* 中央 - Logo圖片 - 手機版置中 */}
              <div className="flex items-center lg:mr-auto">
                <Link to="/" className="flex items-center cursor-pointer outline-none focus:outline-none">
                  <img
                    src="https://public.readdy.ai/ai/img_res/7abd47af-dc1d-4a06-b368-a8eac6dfbf6a.jpg"
                    alt="Inner Saengak Logo"
                    className="w-auto cursor-pointer outline-none focus:outline-none"
                    style={{
                      height: 'min(44px, 2.78vw)', // 手機版稍微增加
                      filter: 'brightness(0.8) contrast(1.2) saturate(1.1)'
                    }}
                  />
                </Link>
              </div>

              {/* 中央 - 完整導航選單 - 桌面版 */}
              <nav
                className="hidden lg:flex items-center justify-center flex-1"
                style={{ gap: 'min(32px, 2.22vw)' }} // 響應式間距
              >
                {/* 產品下拉選單 */}
                <div className="relative">
                  <button
                    onClick={handleProductsClick}
                    onMouseEnter={() => setIsProductDropdownOpen(true)}
                    className="font-semibold flex items-center cursor-pointer transition-colors duration-200 whitespace-nowrap hover:text-teal-600 outline-none focus:outline-none border-none bg-transparent"
                    style={{
                      fontSize: 'min(16px, 1.11vw)',
                      color: '#1F2937',
                      border: 'none',
                      background: 'transparent'
                    }}
                  >
                    全部商品
                  </button>

                  {isProductDropdownOpen && (
                    <div
                      className="absolute top-full left-0 mt-2 w-64 shadow-xl border border-gray-100 z-50 rounded-lg overflow-hidden"
                      style={{ backgroundColor: '#FFFEF2' }}
                      onMouseEnter={() => setIsProductDropdownOpen(true)}
                      onMouseLeave={() => setIsProductDropdownOpen(false)}
                    >
                      <div className="py-2">
                        {productCategories.map((category, index) => (
                          <Link
                            key={index}
                            to={category.href}
                            className="block px-4 py-3 text-sm hover:bg-gray-50 transition-colors duration-200 border-b border-gray-50 last:border-b-0 hover:text-teal-600 outline-none focus:outline-none"
                            style={{ color: '#1F2937' }}
                          >
                            {category.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <Link
                  to="/search?category=女性護理"
                  className="font-semibold transition-colors duration-200 whitespace-nowrap hover:text-teal-600 outline-none focus:outline-none"
                  style={{
                    fontSize: 'min(16px, 1.11vw)',
                    color: '#1F2937'
                  }}
                >
                  女性護理
                </Link>

                <Link
                  to="/search?category=每日清潔"
                  className="font-semibold transition-colors duration-200 whitespace-nowrap hover:text-teal-600 outline-none focus:outline-none"
                  style={{
                    fontSize: 'min(16px, 1.11vw)',
                    color: '#1F2937'
                  }}
                >
                  每日清潔
                </Link>

                <Link
                  to="/search?category=深層修護"
                  className="font-semibold transition-colors duration-200 whitespace-nowrap hover:text-teal-600 outline-none focus:outline-none"
                  style={{
                    fontSize: 'min(16px, 1.11vw)',
                    color: '#1F2937'
                  }}
                >
                  深層修護
                </Link>

                <Link
                  to="/search?category=舒適穿著"
                  className="font-semibold transition-colors duration-200 whitespace-nowrap hover:text-teal-600 outline-none focus:outline-none"
                  style={{
                    fontSize: 'min(16px, 1.11vw)',
                    color: '#1F2937'
                  }}
                >
                  舒適穿著
                </Link>

                <Link
                  to="/promotion"
                  className="font-semibold transition-colors duration-200 whitespace-nowrap hover:text-teal-600 outline-none focus:outline-none"
                  style={{
                    fontSize: 'min(16px, 1.11vw)',
                    color: '#1F2937'
                  }}
                >
                  優惠活動
                </Link>

                <Link
                  to="/community"
                  className="font-semibold transition-colors duration-200 whitespace-nowrap hover:text-teal-600 outline-none focus:outline-none"
                  style={{
                    fontSize: 'min(16px, 1.11vw)',
                    color: '#1F2937'
                  }}
                >
                  社群
                </Link>

                {/* 關於我們 - 直接連結到品牌故事 */}
                <Link
                  to="/brand-story"
                  className="font-semibold transition-colors duration-200 whitespace-nowrap hover:text-teal-600 outline-none focus:outline-none"
                  style={{
                    fontSize: 'min(16px, 1.11vw)',
                    color: '#1F2937'
                  }}
                >
                  關於我們
                </Link>
              </nav>

              {/* 右側 - 功能圖標 - 手機版優化 */}
              <div
                className="flex items-center ml-auto"
                style={{ gap: 'min(16px, 1.39vw)' }} // 手機版減少間距
              >
                {/* 搜尋按鈕 - 手機版也顯示 */}
                <button
                  onClick={handleSearchIconClick}
                  className="flex items-center justify-center cursor-pointer transition-colors duration-200 hover:text-teal-600 outline-none focus:outline-none border-none bg-transparent"
                  style={{
                    width: '44px',
                    height: '44px',
                    border: 'none',
                    background: 'transparent'
                  }}
                >
                  <i
                    className="ri-search-line"
                    style={{
                      fontSize: '28px',
                      color: '#1F2937'
                    }}
                  ></i>
                </button>

                {/* 用戶選單 - 桌面版 */}
                <div className="hidden lg:block relative">
                  <button
                    onClick={handleUserIconClick}
                    className="flex items-center justify-center cursor-pointer transition-colors duration-200 hover:text-teal-600 outline-none focus:outline-none border-none bg-transparent"
                    style={{
                      width: 'min(24px, 1.67vw)',
                      height: 'min(24px, 1.67vw)',
                      border: 'none',
                      background: 'transparent'
                    }}
                  >
                    <i
                      className="ri-user-line"
                      style={{
                        fontSize: 'min(24px, 1.67vw)',
                        color: '#1F2937'
                      }}
                    ></i>
                  </button>

                  {/* 用戶下拉選單 */}
                  {isUserMenuOpen && user && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                      <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-100">
                        <div className="font-medium">
                          {user.name || user.user_metadata?.name || user.email}
                        </div>
                        <div className="text-gray-500 text-xs">{user.email}</div>
                      </div>
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          navigate('/profile');
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                      >
                        <i className="ri-user-line mr-2"></i>
                        會員中心
                      </button>
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          navigate('/profile?tab=orders');
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                      >
                        <i className="ri-shopping-bag-line mr-2"></i>
                        訂單查詢
                      </button>
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          navigate('/profile?tab=favorites');
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                      >
                        <i className="ri-heart-line mr-2"></i>
                        我的收藏
                      </button>
                      <div className="border-t border-gray-100 mt-1">
                        <button
                          onClick={handleLogout}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                        >
                          <i className="ri-logout-box-line mr-2"></i>
                          登出
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 購物車按鈕 - 手機版優化 */}
                <button
                  onClick={handleCartClick}
                  className="flex items-center justify-center cursor-pointer relative transition-colors duration-200 hover:text-teal-600 outline-none focus:outline-none border-none bg-transparent"
                  style={{
                    width: '44px',
                    height: '44px',
                    border: 'none',
                    background: 'transparent'
                  }}
                >
                  <i
                    className="ri-shopping-bag-line"
                    style={{
                      fontSize: '28px',
                      color: '#1F2937'
                    }}
                  ></i>
                  <span
                    className="absolute -top-1 -right-1 text-white flex items-center justify-center text-center leading-none"
                    style={{
                      backgroundColor: '#EF4444',
                      borderRadius: '50%',
                      width: '20px',
                      height: '20px',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}
                  >
                    {getTotalItems()}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 手機版 - 頂部簡化 Logo 欄 */}
      <header
        className="lg:hidden fixed top-0 left-0 w-full z-50 bg-white"
        style={{ marginTop: '32px' }}
      >
        <div className="flex items-center justify-center h-16 px-4">
          <Link to="/" className="flex items-center cursor-pointer">
            <img
              src="https://public.readdy.ai/ai/img_res/7abd47af-dc1d-4a06-b368-a8eac6dfbf6a.jpg"
              alt="Inner Saengak Logo"
              className="h-10 w-auto"
              style={{
                filter: 'brightness(0.8) contrast(1.2) saturate(1.1)'
              }}
            />
          </Link>
        </div>
      </header>

      {/* 手機版 - 底部膠囊式懸浮導航 */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 pb-6 px-4 pointer-events-none">
        <div className="flex items-center justify-between gap-3 pointer-events-auto">
          {/* 左側膠囊 - 選單按鈕 */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex items-center gap-2 px-5 py-3 bg-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer border-none outline-none focus:outline-none"
            style={{
              fontFamily: "Noto Sans TC, sans-serif"
            }}
          >
            <i
              className={isMobileMenuOpen ? "ri-close-line" : "ri-menu-line"}
              style={{
                fontSize: '24px',
                color: '#1F2937'
              }}
            ></i>
            <span className="text-sm font-semibold text-gray-900">選單</span>
          </button>

          {/* 中間膠囊 - 搜尋按鈕 */}
          <button
            onClick={handleSearchIconClick}
            className="flex items-center justify-center w-14 h-14 bg-teal-600 rounded-full shadow-lg hover:shadow-xl hover:bg-teal-700 transition-all duration-200 cursor-pointer border-none outline-none focus:outline-none"
          >
            <i
              className="ri-search-line"
              style={{
                fontSize: '24px',
                color: '#FFFFFF'
              }}
            ></i>
          </button>

          {/* 右側膠囊 - 購物車按鈕 */}
          <button
            onClick={handleCartClick}
            className="flex items-center gap-2 px-5 py-3 bg-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer relative border-none outline-none focus:outline-none"
            style={{
              fontFamily: "Noto Sans TC, sans-serif"
            }}
          >
            <i
              className="ri-shopping-bag-line"
              style={{
                fontSize: '24px',
                color: '#1F2937'
              }}
            ></i>
            <span className="text-sm font-semibold text-gray-900">購物車</span>
            {getTotalItems() > 0 && (
              <span
                className="absolute -top-1 -right-1 text-white flex items-center justify-center"
                style={{
                  backgroundColor: '#EF4444',
                  borderRadius: '50%',
                  width: '22px',
                  height: '22px',
                  fontSize: '12px',
                  fontWeight: '600'
                }}
              >
                {getTotalItems()}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 手機版全屏選單 */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" style={{ marginTop: '96px' }}>
          {/* 背景遮罩 */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>
          
          {/* 選單內容 - 從底部滑入 */}
          <div 
            className="absolute inset-x-0 bottom-0 bg-white shadow-2xl overflow-y-auto rounded-t-3xl"
            style={{ 
              maxHeight: 'calc(100vh - 96px - 100px)',
              animation: 'slideUp 0.3s ease-out'
            }}
          >
            <nav className="py-6">
              {/* 全部商品 */}
              <Link
                to="/search?query=all"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block w-full text-left px-6 py-4 text-lg font-semibold text-gray-800 hover:bg-gray-50 transition-colors duration-200 border-b border-gray-100"
              >
                <i className="ri-store-line mr-3 text-xl text-teal-600"></i>
                全部商品
              </Link>

              {/* 產品分類 */}
              <div className="border-b border-gray-200 pb-2">
                <div className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">產品分類</div>
                {productCategories.map((category, index) => (
                  <Link
                    key={index}
                    to={category.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block w-full text-left px-6 py-3 text-base text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                  >
                    {category.name}
                  </Link>
                ))}
              </div>

              {/* 其他選單項目 */}
              <div className="border-b border-gray-200 pb-2">
                <Link
                  to="/promotion"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block w-full text-left px-6 py-4 text-lg font-semibold text-gray-800 hover:bg-gray-50 transition-colors duration-200"
                >
                  <i className="ri-gift-line mr-3 text-xl text-teal-600"></i>
                  優惠活動
                </Link>

                <Link
                  to="/community"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block w-full text-left px-6 py-4 text-lg font-semibold text-gray-800 hover:bg-gray-50 transition-colors duration-200"
                >
                  <i className="ri-team-line mr-3 text-xl text-teal-600"></i>
                  社群
                </Link>

                <Link
                  to="/brand-story"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block w-full text-left px-6 py-4 text-lg font-semibold text-gray-800 hover:bg-gray-50 transition-colors duration-200"
                >
                  <i className="ri-book-open-line mr-3 text-xl text-teal-600"></i>
                  關於我們
                </Link>
              </div>

              {/* 用戶選單 */}
              <div className="pt-2">
                {user ? (
                  <>
                    <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                      <div className="font-semibold text-base text-gray-800">
                        {user.name || user.user_metadata?.name || user.email}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">{user.email}</div>
                    </div>
                    <Link
                      to="/profile"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="block w-full text-left px-6 py-4 text-base text-gray-700 hover:bg-gray-50 transition-colors duration-200 flex items-center"
                    >
                      <i className="ri-user-line mr-3 text-xl text-teal-600"></i>
                      會員中心
                    </Link>
                    <Link
                      to="/profile?tab=orders"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="block w-full text-left px-6 py-4 text-base text-gray-700 hover:bg-gray-50 transition-colors duration-200 flex items-center"
                    >
                      <i className="ri-shopping-bag-line mr-3 text-xl text-teal-600"></i>
                      訂單查詢
                    </Link>
                    <Link
                      to="/profile?tab=favorites"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="block w-full text-left px-6 py-4 text-base text-gray-700 hover:bg-gray-50 transition-colors duration-200 flex items-center"
                    >
                      <i className="ri-heart-line mr-3 text-xl text-teal-600"></i>
                      我的收藏
                    </Link>
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        handleLogout();
                      }}
                      className="block w-full text-left px-6 py-4 text-base text-gray-700 hover:bg-gray-50 transition-colors duration-200 flex items-center border-t border-gray-200"
                    >
                      <i className="ri-logout-box-line mr-3 text-xl text-teal-600"></i>
                      登出
                    </button>
                  </>
                ) : (
                  <Link
                    to="/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block w-full text-left px-6 py-4 text-lg font-semibold text-gray-800 hover:bg-gray-50 transition-colors duration-200 flex items-center"
                  >
                    <i className="ri-user-line mr-3 text-xl text-teal-600"></i>
                    登入 / 註冊
                  </Link>
                )}
              </div>
            </nav>
          </div>
        </div>
      )}

      {/* Search Overlay */}
      <SearchOverlay
        isOpen={isSearchOverlayOpen}
        onClose={() => setIsSearchOverlayOpen(false)}
      />

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        mode={authMode}
        onSwitchMode={setAuthMode}
      />

      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}
