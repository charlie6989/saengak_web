import EditorialHero from '../../../components/feature/EditorialHero';

export default function BrandSection() {
  return (
    <EditorialHero
      image="/images/lucissi-v5/home-brand.webp"
      alt="護理產品與親膚內著的俯拍選品陳列"
      eyebrow="LUCISSI CARE · THOUGHTFULLY SELECTED"
      headingLevel="h2"
      priority={false}
      title="為妳的日常，細心挑選"
      description="從私密保養、舒適內搭，到生理期的每一天，每一個選擇，都回到自己的舒適感受。"
    >
      <a href="/search" className="mt-7 inline-flex bg-brand px-6 py-3 text-sm font-semibold text-white">查看所有產品</a>
    </EditorialHero>
  );
}
