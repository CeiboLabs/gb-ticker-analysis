import type { NewsItem } from "@/types/StockData";

interface Props {
  news: NewsItem[];
}

export function NewsSection({ news }: Props) {
  if (!news || news.length === 0) return null;

  return (
    <div className="bg-white border border-[#03065E]/10 rounded-xl p-4 mt-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#03065E]/50 mb-3">
        Noticias Recientes
      </p>
      <ul className="divide-y divide-[#03065E]/8">
        {news.map((item, i) => (
          <li key={i} className="py-2.5 first:pt-0 last:pb-0">
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-[#03065E] hover:underline leading-snug block"
            >
              {item.title}
            </a>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-[#707070]">{item.publisher}</span>
              {item.publishedAt && (
                <span className="text-xs text-[#707070]/60">{item.publishedAt}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
