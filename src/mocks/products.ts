
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
    vendor?: string;
    handle?: string;
    highlights?: string[];
    subtitle?: string;
    promotionBadge?: string;
}

export const mockProducts: Product[] = [
    {
        id: '1',
        name: '益生菌私密舒緩凝膠',
        subtitle: '韓國 | 韓國 Dermatest | 女性清潔劑',
        description: '展示品項；完整成分、敏感肌適用性與使用方式待正式商品資料確認',
        image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=800',
        hoverImage: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&q=80&w=800',
        price: 1280,
        originalPrice: 1600,
        isBest: true,
        isNew: false,
        tags: ['女性護理', '私密護理', '舒緩', '凝膠'],
        promotionBadge: '2+1 促銷價，享受驚喜折扣！',
        highlights: [
            '不含 21 種有害成分',
            '使用植物性萃取成分',
            'pH 4.5~5.5 弱酸性配方',
            '醫學等級皮膚測試認證'
        ],
        images: [
            { url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=800' },
            { url: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&q=80&w=800' },
            { url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=800' },
            { url: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&q=80&w=800' },
            { url: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&q=80&w=800' },
            { url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=800' },
            { url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&q=80&w=800' },
            { url: 'https://images.unsplash.com/photo-1526947425960-945c6e72858f?auto=format&fit=crop&q=80&w=800' }
        ]
    },
    {
        id: '2',
        name: '抗菌無痕內褲 - 舒適款',
        subtitle: '親膚純棉 | 無痕透氣 | 每日舒適首選',
        description: '展示款式；纖維成分、抗菌測試與剪裁規格待正式商品資料確認',
        image: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&q=80&w=800',
        hoverImage: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&q=80&w=800',
        price: 890,
        originalPrice: 1200,
        isBest: false,
        isNew: true,
        tags: ['抗菌', '無痕', '內褲', '舒適'],
        highlights: [
            '100% 純棉親膚透氣雙層底襠',
            '超細細膩彈力纖維，貼身不緊繃',
            '立體美型剪裁，服貼無痕零著感',
            '嚴選安心染料，親膚不易褪色'
        ],
        images: [
            { url: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&q=80&w=800' },
            { url: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&q=80&w=800' }
        ]
    },
    {
        id: '3',
        variantId: 'gid://shopify/ProductVariant/43639647502403',
        name: '深層修護私密清潔露',
        description: '展示清潔品項；成分、pH 值與適用方式待正式商品資料確認',
        image: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&q=80&w=800',
        hoverImage: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=800',
        price: 680,
        isBest: false,
        isNew: false,
        tags: ['清潔', '修護', '私密護理', '深層'],
        images: [
            { url: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&q=80&w=800' },
            { url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=800' }
        ]
    },
    {
        id: '4',
        name: '生理褲 - 超薄款',
        description: '展示生理褲品項；厚度、吸收層與使用限制待正式商品資料確認',
        image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=800',
        hoverImage: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=800',
        price: 1450,
        originalPrice: 1800,
        isBest: true,
        isNew: true,
        tags: ['生理褲', '超薄', '保護'],
        images: [
            { url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=800' },
            { url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=800' }
        ]
    },
    {
        id: '5',
        name: '舒適純棉內褲組合',
        description: '展示內褲組合；棉含量、洗滌方式與尺寸待正式商品資料確認',
        image: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&q=80&w=800',
        hoverImage: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&q=80&w=800',
        price: 1200,
        isBest: false,
        isNew: false,
        tags: ['純棉', '舒適', '內褲', '透氣'],
        images: [
            { url: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&q=80&w=800' },
            { url: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&q=80&w=800' }
        ]
    },
    {
        id: '6',
        name: '無痕收腹內褲',
        description: '展示剪裁品項；材質、尺寸與穿著效果待正式商品資料確認',
        image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=800',
        hoverImage: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=800',
        price: 980,
        originalPrice: 1300,
        isBest: false,
        isNew: false,
        tags: ['無痕', '收腹', '塑形', '內褲'],
        images: [
            { url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&q=80&w=800' },
            { url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=800' }
        ]
    }
];

export const getMockProductById = (id: string): Product | undefined => {
    return mockProducts.find(p => p.id === id);
};
