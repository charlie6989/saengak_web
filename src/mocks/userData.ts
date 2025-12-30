// 假用戶數據
export const mockUsers = [
  {
    id: 'user-001',
    email: 'demo@example.com',
    password: '123456',
    name: '王小美',
    phone: '0912-345-678',
    address: '台北市信義區信義路五段7號',
    birth_date: '1990-05-15',
    gender: 'female',
    created_at: '2024-01-15T08:30:00Z',
    avatar: 'https://readdy.ai/api/search-image?query=professional%20asian%20woman%20portrait%20smiling%20friendly%20business%20casual%20modern%20clean%20background&width=200&height=200&seq=avatar1&orientation=squarish'
  },
  {
    id: 'user-002',
    email: 'test@gmail.com',
    password: '123456',
    name: '李雅婷',
    phone: '0987-654-321',
    address: '新北市板橋區文化路一段188號',
    birth_date: '1985-08-22',
    gender: 'female',
    created_at: '2024-02-01T10:15:00Z',
    avatar: 'https://readdy.ai/api/search-image?query=young%20asian%20woman%20smiling%20natural%20makeup%20casual%20style%20modern%20portrait%20clean%20background&width=200&height=200&seq=avatar2&orientation=squarish'
  },
  {
    id: 'user-003',
    email: 'user@test.com',
    password: '123456',
    name: '陳美玲',
    phone: '0955-123-456',
    address: '台中市西屯區台灣大道三段99號',
    birth_date: '1992-12-03',
    gender: 'female',
    created_at: '2024-02-10T14:20:00Z',
    avatar: 'https://readdy.ai/api/search-image?query=confident%20asian%20woman%20professional%20headshot%20warm%20smile%20contemporary%20style%20clean%20white%20background&width=200&height=200&seq=avatar3&orientation=squarish'
  }
];

// 假訂單數據
export const mockOrders = [
  {
    id: 'order-001',
    user_id: 'user-001',
    order_number: 'VG2024030001',
    total_amount: 1580,
    status: 'completed',
    created_at: '2024-03-01T09:30:00Z',
    items: [
      {
        id: 'item-001',
        product_name: 'VAGI 私密護理潔淨慕斯',
        quantity: 2,
        price: 590,
        image_url: 'https://readdy.ai/api/search-image?query=elegant%20feminine%20hygiene%20foam%20cleanser%20bottle%20white%20clean%20minimalist%20packaging%20premium%20skincare%20product%20photography&width=300&height=300&seq=product1&orientation=squarish'
      },
      {
        id: 'item-002',
        product_name: '益生菌私密舒緩凝膠',
        quantity: 1,
        price: 400,
        image_url: 'https://readdy.ai/api/search-image?query=premium%20probiotic%20intimate%20gel%20tube%20white%20clean%20medical%20grade%20packaging%20feminine%20care%20product%20photography&width=300&height=300&seq=product2&orientation=squarish'
      }
    ]
  },
  {
    id: 'order-002',
    user_id: 'user-001',
    order_number: 'VG2024030015',
    total_amount: 2340,
    status: 'processing',
    created_at: '2024-03-15T14:45:00Z',
    items: [
      {
        id: 'item-003',
        product_name: '深層修護精華液',
        quantity: 1,
        price: 890,
        image_url: 'https://readdy.ai/api/search-image?query=luxury%20feminine%20care%20serum%20bottle%20elegant%20glass%20packaging%20premium%20skincare%20product%20white%20background%20professional%20photography&width=300&height=300&seq=product3&orientation=squarish'
      },
      {
        id: 'item-004',
        product_name: '舒適透氣內褲組合',
        quantity: 3,
        price: 450,
        image_url: 'https://readdy.ai/api/search-image?query=comfortable%20breathable%20womens%20underwear%20set%20pastel%20colors%20cotton%20fabric%20premium%20intimate%20apparel%20clean%20white%20background&width=300&height=300&seq=product4&orientation=squarish'
      }
    ]
  },
  {
    id: 'order-003',
    user_id: 'user-002',
    order_number: 'VG2024030022',
    total_amount: 1190,
    status: 'shipped',
    created_at: '2024-03-22T11:20:00Z',
    items: [
      {
        id: 'item-005',
        product_name: '每日護理濕巾',
        quantity: 4,
        price: 290,
        image_url: 'https://readdy.ai/api/search-image?query=feminine%20hygiene%20wet%20wipes%20package%20clean%20white%20packaging%20gentle%20care%20product%20photography%20minimalist%20design&width=300&height=300&seq=product5&orientation=squarish'
      }
    ]
  }
];

// 假收藏數據
export const mockFavorites = [
  {
    id: 'fav-001',
    user_id: 'user-001',
    product_id: 'prod-001',
    product_name: 'VAGI 私密護理潔淨慕斯',
    product_price: 590,
    product_image: 'https://readdy.ai/api/search-image?query=elegant%20feminine%20hygiene%20foam%20cleanser%20bottle%20white%20clean%20minimalist%20packaging%20premium%20skincare%20product%20photography&width=300&height=300&seq=product1&orientation=squarish',
    created_at: '2024-03-01T09:30:00Z'
  },
  {
    id: 'fav-002',
    user_id: 'user-001',
    product_id: 'prod-002',
    product_name: '深層修護精華液',
    product_price: 890,
    product_image: 'https://readdy.ai/api/search-image?query=luxury%20feminine%20care%20serum%20bottle%20elegant%20glass%20packaging%20premium%20skincare%20product%20white%20background%20professional%20photography&width=300&height=300&seq=product3&orientation=squarish',
    created_at: '2024-03-10T16:15:00Z'
  }
];

// 模擬登入狀態
export const mockAuthState = {
  isLoggedIn: false,
  currentUser: null as typeof mockUsers[0] | null
};

// 模擬 API 延遲
export const simulateApiDelay = (ms: number = 1000) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};