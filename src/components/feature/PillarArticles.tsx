import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getShopifyArticles } from '../../lib/shopify';
import { editorialImage } from '../../content/editorialImages';
import { TALK_FALLBACK_ARTICLES, type TalkArticlePreview } from '../../content/talkFallbackArticles';
import type { CarePillar } from '../../content/carePillars';

/** 依面向的文章標籤挑出最相關的三篇；沒有相關標籤時依原順序補滿。 */
export function pickPillarArticles(articles: TalkArticlePreview[], tags: string[], count = 3): TalkArticlePreview[] {
  const score = (article: TalkArticlePreview) => article.tags.filter((tag) => tags.includes(tag)).length;
  return [...articles]
    .map((article, index) => ({ article, index, score: score(article) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, count)
    .map(({ article }) => article);
}

/** 商品還不多的面向，用 LUCISSI Talk 文章陪伴瀏覽，不讓分類頁留白。 */
export default function PillarArticles({ pillar, hasProducts }: { pillar: CarePillar; hasProducts: boolean }) {
  const [articles, setArticles] = useState<TalkArticlePreview[]>([]);

  useEffect(() => {
    let active = true;
    getShopifyArticles(12)
      .then((items) => {
        const source: TalkArticlePreview[] = items && items.length > 0
          ? items.map((item) => ({
              id: item.id,
              handle: item.handle,
              title: item.title,
              excerpt: item.excerpt || '',
              contentHtml: item.contentHtml || '',
              tags: item.tags || [],
              publishedAt: item.publishedAt,
              image: { url: editorialImage(item.handle, item.image?.url), altText: item.title },
            }))
          : TALK_FALLBACK_ARTICLES;
        if (active) setArticles(pickPillarArticles(source, pillar.articleTags));
      })
      .catch(() => {
        if (active) setArticles(pickPillarArticles(TALK_FALLBACK_ARTICLES, pillar.articleTags));
      });
    return () => { active = false; };
  }, [pillar]);

  if (articles.length === 0) return null;

  return (
    <section aria-labelledby={`pillar-talk-${pillar.id}`} className="border-t border-gray-200 py-12 sm:py-16">
      <p className="mb-3 text-xs font-medium tracking-[0.18em] text-brand">LUCISSI TALK</p>
      <h2 id={`pillar-talk-${pillar.id}`} className="mb-3 text-2xl font-semibold text-brand md:text-3xl">
        {hasProducts ? `更多${pillar.name}的日常` : `${pillar.name}，正在準備中`}
      </h2>
      <p className="mb-8 max-w-2xl text-base leading-relaxed text-gray-500">
        {hasProducts
          ? '選品陸續增加中。先從這幾篇文章，認識照顧自己的不同方式。'
          : '我們正在為這個系列細心挑選。在那之前，先從這幾篇文章，認識照顧自己的不同方式。'}
      </p>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {articles.map((article) => (
          <Link key={article.id} to={`/blog/${article.handle || article.id}`} className="group flex flex-col border border-gray-200 bg-white">
            <div className="aspect-4/3 overflow-hidden">
              <img src={article.image.url} alt={article.image.altText} loading="lazy" className="h-full w-full object-cover" />
            </div>
            <div className="flex flex-1 flex-col gap-2 p-6">
              <span className="self-start bg-brand px-3 py-1 text-xs font-medium text-white">{article.tags[0] || '專欄文章'}</span>
              <h3 className="line-clamp-2 text-lg font-bold leading-7 text-gray-900 group-hover:text-brand">{article.title}</h3>
              <p className="line-clamp-2 text-sm text-gray-500">{article.excerpt}</p>
            </div>
          </Link>
        ))}
      </div>
      <Link to="/community" className="mt-8 inline-flex border-b border-brand pb-1 text-sm font-medium text-brand">
        閱讀更多 LUCISSI Talk<span aria-hidden="true" className="ml-4">→</span>
      </Link>
    </section>
  );
}
