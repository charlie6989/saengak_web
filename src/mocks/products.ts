
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
    reviews?: number;
    isBest?: boolean;
    isNew?: boolean;
    tags?: string[];
    productType?: string;
    vendor?: string;
    handle?: string;
}

export const mockProducts: Product[] = [
    {
        id: '1',
        name: '益生菌私密舒緩凝膠',
        description: '溫和配方，專為敏感肌膚設計的私密護理產品',
        image: 'https://readdy.ai/api/search-image?query=Premium%20feminine%20care%20gel%20product%20with%20clean%20minimalist%20packaging%2C%20soft%20pink%20and%20white%20colors%2C%20professional%20product%20photography%2C%20simple%20background&width=400&height=400&seq=product1&orientation=squarish',
        hoverImage: 'https://readdy.ai/api/search-image?query=Feminine%20care%20gel%20product%20detail%20shot%20showing%20texture%20and%20ingredients%2C%20clean%20aesthetic%2C%20professional%20lighting&width=400&height=400&seq=product1-hover&orientation=squarish',
        price: 1280,
        originalPrice: 1600,
        reviews: 156,
        isBest: true,
        isNew: false,
        tags: ['女性護理', '私密護理', '舒緩', '凝膠'],
        images: [
            { url: 'https://readdy.ai/api/search-image?query=Premium%20feminine%20care%20gel%20product%20with%20clean%20minimalist%20packaging%2C%20soft%20pink%20and%20white%20colors%2C%20professional%20product%20photography%2C%20simple%20background&width=400&height=400&seq=product1&orientation=squarish' },
            { url: 'https://readdy.ai/api/search-image?query=Feminine%20care%20gel%20product%20detail%20shot%20showing%20texture%20and%20ingredients%2C%20clean%20aesthetic%2C%20professional%20lighting&width=400&height=400&seq=product1-hover&orientation=squarish' }
        ]
    },
    {
        id: '2',
        name: '抗菌無痕內褲 - 舒適款',
        description: '採用抗菌纖維，無痕設計，全天候舒適穿著',
        image: 'https://readdy.ai/api/search-image?query=Premium%20seamless%20antibacterial%20underwear%20in%20neutral%20colors%2C%20clean%20product%20photography%2C%20minimalist%20style&width=400&height=400&seq=product2&orientation=squarish',
        hoverImage: 'https://readdy.ai/api/search-image?query=Seamless%20underwear%20fabric%20detail%20showing%20texture%20and%20comfort%20features%2C%20professional%20product%20shot&width=400&height=400&seq=product2-hover&orientation=squarish',
        price: 890,
        originalPrice: 1200,
        reviews: 203,
        isBest: false,
        isNew: true,
        tags: ['抗菌', '無痕', '內褲', '舒適'],
        images: [
            { url: 'https://readdy.ai/api/search-image?query=Premium%20seamless%20antibacterial%20underwear%20in%20neutral%20colors%2C%20clean%20product%20photography%2C%20minimalist%20style&width=400&height=400&seq=product2&orientation=squarish' },
            { url: 'https://readdy.ai/api/search-image?query=Seamless%20underwear%20fabric%20detail%20showing%20texture%20and%20comfort%20features%2C%20professional%20product%20shot&width=400&height=400&seq=product2-hover&orientation=squarish' }
        ]
    },
    {
        id: '3',
        name: '深層修護私密清潔露',
        description: '溫和深層清潔，維持私密部位健康平衡',
        image: 'https://readdy.ai/api/search-image?query=Feminine%20intimate%20wash%20cleanser%20bottle%20with%20elegant%20design%2C%20soft%20blue%20and%20white%20packaging%2C%20professional%20product%20photography&width=400&height=400&seq=product3&orientation=squarish',
        hoverImage: 'https://readdy.ai/api/search-image?query=Intimate%20cleanser%20product%20with%20natural%20ingredients%20display%2C%20clean%20aesthetic%2C%20professional%20lighting&width=400&height=400&seq=product3-hover&orientation=squarish',
        price: 680,
        reviews: 89,
        isBest: false,
        isNew: false,
        tags: ['清潔', '修護', '私密護理', '深層'],
        images: [
            { url: 'https://readdy.ai/api/search-image?query=Feminine%20intimate%20wash%20cleanser%20bottle%20with%20elegant%20design%2C%20soft%20blue%20and%20white%20packaging%2C%20professional%20product%20photography&width=400&height=400&seq=product3&orientation=squarish' },
            { url: 'https://readdy.ai/api/search-image?query=Intimate%20cleanser%20product%20with%20natural%20ingredients%20display%2C%20clean%20aesthetic%2C%20professional%20lighting&width=400&height=400&seq=product3-hover&orientation=squarish' }
        ]
    },
    {
        id: '4',
        name: '生理褲 - 超薄款',
        description: '超薄設計，生理期專用，提供全方位保護',
        image: 'https://readdy.ai/api/search-image?query=Ultra-thin%20period%20underwear%20in%20soft%20colors%2C%20comfortable%20design%2C%20professional%20product%20photography%2C%20clean%20background&width=400&height=400&seq=product4&orientation=squarish',
        hoverImage: 'https://readdy.ai/api/search-image?query=Period%20underwear%20showing%20absorption%20layers%20and%20comfort%20features%2C%20detailed%20product%20shot&width=400&height=400&seq=product4-hover&orientation=squarish',
        price: 1450,
        originalPrice: 1800,
        reviews: 267,
        isBest: true,
        isNew: true,
        tags: ['生理褲', '超薄', '保護'],
        images: [
            { url: 'https://readdy.ai/api/search-image?query=Ultra-thin%20period%20underwear%20in%20soft%20colors%2C%20comfortable%20design%2C%20professional%20product%20photography%2C%20clean%20background&width=400&height=400&seq=product4&orientation=squarish' },
            { url: 'https://readdy.ai/api/search-image?query=Period%20underwear%20showing%20absorption%20layers%20and%20comfort%20features%2C%20detailed%20product%20shot&width=400&height=400&seq=product4-hover&orientation=squarish' }
        ]
    },
    {
        id: '5',
        name: '舒適純棉內褲組合',
        description: '100% 純棉材質，透氣舒適，日常穿著首選',
        image: 'https://readdy.ai/api/search-image?query=Pure%20cotton%20underwear%20set%20in%20natural%20colors%2C%20comfortable%20design%2C%20professional%20product%20photography%2C%20minimalist%20style&width=400&height=400&seq=product5&orientation=squarish',
        hoverImage: 'https://readdy.ai/api/search-image?query=Cotton%20underwear%20fabric%20detail%20showing%20softness%20and%20breathability%2C%20professional%20product%20shot&width=400&height=400&seq=product5-hover&orientation=squarish',
        price: 1200,
        reviews: 145,
        isBest: false,
        isNew: false,
        tags: ['純棉', '舒適', '內褲', '透氣'],
        images: [
            { url: 'https://readdy.ai/api/search-image?query=Pure%20cotton%20underwear%20set%20in%20natural%20colors%2C%20comfortable%20design%2C%20professional%20product%20photography%2C%20minimalist%20style&width=400&height=400&seq=product5&orientation=squarish' },
            { url: 'https://readdy.ai/api/search-image?query=Cotton%20underwear%20fabric%20detail%20showing%20softness%20and%20breathability%2C%20professional%20product%20shot&width=400&height=400&seq=product5-hover&orientation=squarish' }
        ]
    },
    {
        id: '6',
        name: '無痕收腹內褲',
        description: '塑形收腹設計，無痕剪裁，展現完美身形',
        image: 'https://readdy.ai/api/search-image?query=Seamless%20shaping%20underwear%20with%20tummy%20control%2C%20elegant%20design%2C%20professional%20product%20photography%2C%20neutral%20colors&width=400&height=400&seq=product6&orientation=squarish',
        hoverImage: 'https://readdy.ai/api/search-image?query=Shaping%20underwear%20showing%20control%20features%20and%20seamless%20design%2C%20detailed%20product%20shot&width=400&height=400&seq=product6-hover&orientation=squarish',
        price: 980,
        originalPrice: 1300,
        reviews: 178,
        isBest: false,
        isNew: false,
        tags: ['無痕', '收腹', '塑形', '內褲'],
        images: [
            { url: 'https://readdy.ai/api/search-image?query=Seamless%20shaping%20underwear%20with%20tummy%20control%2C%20elegant%20design%2C%20professional%20product%20photography%2C%20neutral%20colors&width=400&height=400&seq=product6&orientation=squarish' },
            { url: 'https://readdy.ai/api/search-image?query=Shaping%20underwear%20showing%20control%20features%20and%20seamless%20design%2C%20detailed%20product%20shot&width=400&height=400&seq=product6-hover&orientation=squarish' }
        ]
    }
];

export const getMockProductById = (id: string): Product | undefined => {
    return mockProducts.find(p => p.id === id);
};
