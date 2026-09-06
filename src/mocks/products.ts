
export interface Product {
    id: string;
    name: string;
    description: string;
    descriptionHtml?: string;
    price: number;
    originalPrice?: number;
    image: string;
    hoverImage: string;
    images?: { url: string }[];
    variants?: any[];
    variantId?: string;
    reviews?: number;
    isBest?: boolean;
    isNew?: boolean;
    tags?: string[];
    productType?: string;
    category?: string;
    vendor?: string;
    availableForSale?: boolean;
    handle?: string;
    highlights?: string[];
    subtitle?: string;
    promotionBadge?: string;
}

export const mockProducts: Product[] = [
    {
        id: '7819899994179',
        name: 'Saengak 平衡調理私密潔淨慕斯',
        subtitle: '韓國植萃調理 | 專利微米弱酸泡沫',
        description: '微米綿密弱酸泡泡 溫和淨化異味',
        image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=800',
        hoverImage: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&q=80&w=800',
        price: 890,
        originalPrice: 1080,
        isBest: true,
        isNew: true,
        productType: '每日清潔',
        tags: ['每日清潔', '私密護理', '慕斯', '清潔'],
        highlights: [
            '微米綿密細緻弱酸泡沫',
            '深層淨化異味與分泌物困擾',
            'pH 弱酸平衡私密微生態'
        ]
    },
    {
        id: '7819900551235',
        name: 'Saengak 益生菌私密養膚濕巾',
        subtitle: '隨身單片便攜 | 純淨草本萃取',
        description: '如水般親膚溫和植萃 隨身潔淨清新',
        image: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&q=80&w=800',
        hoverImage: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=800',
        price: 390,
        originalPrice: 480,
        isBest: true,
        isNew: true,
        productType: '每日清潔',
        tags: ['每日清潔', '濕巾', '便攜', '養膚'],
        highlights: [
            '如水般親膚溫和植萃成分',
            '單片獨立密封包裝方便隨身',
            '維持全天候潔淨清新'
        ]
    },
    {
        id: '7819995545667',
        name: 'Saengak 私密雙層修護精華噴霧',
        subtitle: '德國專利燕麥活性成分 | 雙層水油',
        description: '雙層水油黃金配比 隨手安撫舒緩',
        image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=800',
        hoverImage: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&q=80&w=800',
        price: 980,
        originalPrice: 1280,
        isBest: true,
        isNew: true,
        productType: '女性護理',
        tags: ['女性護理', '噴霧', '雙層修護', '修護'],
        highlights: [
            '德國專利燕麥活性修護成分',
            '精華油與植萃雙層黃金配比',
            '隨手一噴即時安撫乾燥與異味'
        ]
    },
    {
        id: '3',
        variantId: 'gid://shopify/ProductVariant/43639647502403',
        name: 'Saengak 深層修護私密清潔露',
        subtitle: '專利草本萃取 | 溫和舒緩修護',
        description: '專利植萃溫和淨膚 深層舒緩修護',
        image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=800',
        hoverImage: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&q=80&w=800',
        price: 780,
        originalPrice: 980,
        isBest: false,
        isNew: false,
        productType: '深層修護',
        tags: ['深層修護', '清潔露', '修護', '私密護理'],
        highlights: [
            '專利草本植萃溫和淨膚配方',
            '深層舒緩修護私密嬌嫩肌膚',
            '洗後保濕清爽不緊繃'
        ]
    }

];

export const getMockProductById = (id: string): Product | undefined => {
    return mockProducts.find(p => p.id === id);
};
