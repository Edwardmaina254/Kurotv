import { Link } from 'react-router-dom';

export default function TrendingSidebar({ trendingList }: { trendingList: any[] }) {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-fg">
          Top Trending
        </h3>
        <span className="text-[9px] font-semibold text-accent bg-accent-muted px-2 py-0.5 rounded-full uppercase tracking-wider">Now</span>
      </div>

      <div className="flex flex-col gap-4">
        {trendingList.slice(0, 10).map((anime, index) => (
          <Link
            key={anime.id}
            to={`/anime/${anime.id}?ep=1`}
            className="flex items-center gap-3 group"
          >
            <span className="text-lg font-bold italic text-border group-hover:text-accent-dim transition-colors w-6 shrink-0 font-display">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-muted group-hover:text-fg transition-colors truncate">
                {anime.title}
              </div>
              <div className="text-[10px] text-muted font-medium mt-0.5 uppercase tracking-wider">
                {anime.subOrDub || "SUB"} · TV
              </div>
            </div>
            <div className="rounded-lg overflow-hidden border border-border shrink-0">
              <img src={anime.image} alt={anime.title} className="w-10 h-14 object-cover" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
