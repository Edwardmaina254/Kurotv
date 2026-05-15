// src/components/TrendingSidebar.tsx
import { Link } from 'react-router-dom';

export default function TrendingSidebar({ trendingList }: { trendingList: any[] }) {
  return (
    <div className="bg-[#040404]/80 backdrop-blur-3xl rounded-[38px] border border-white/10 w-[360px] p-8 shadow-[0_30px_100px_rgba(0,0,0,0.9)] ring-1 ring-inset ring-white/10">
      <div className="flex items-center justify-between mb-10">
        <h3 className="font-black text-[12px] uppercase tracking-[0.25em] text-white flex items-center gap-3">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shadow-[0_0_10px_#3b82f6]" />
          Top Trending
        </h3>
        <div className="bg-blue-600 text-[10px] font-black px-2.5 py-1 rounded-lg text-white shadow-lg shadow-blue-600/30">
          NOW
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {trendingList.slice(0, 10).map((anime, index) => (
          // 🔥 CHANGED TO <Link> TAG SO YOU CAN RIGHT CLICK -> OPEN IN NEW TAB
          <Link
            key={anime.id}
            to={`/anime/${anime.id}`}
            className="flex items-center gap-5 group cursor-pointer block"
          >
            <div className="text-2xl font-black italic text-white/5 group-hover:text-blue-600/40 transition-all duration-500 w-8">
              {index + 1}
            </div>

            <div className="flex-1 min-w-0">
              <div className="font-bold text-[14px] leading-tight truncate text-gray-400 group-hover:text-white transition-all duration-300">
                {anime.title}
              </div>
              <div className="text-[10px] text-gray-600 font-bold mt-2 uppercase tracking-widest flex items-center gap-2">
                <span className="text-blue-500/80">{anime.subOrDub || "SUB"}</span>
                <span className="w-1 h-1 rounded-full bg-gray-800" />
                <span>TV</span>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-xl border border-white/5 group-hover:border-blue-500/50 transition-all duration-300">
              <img
                src={anime.image}
                alt={anime.title}
                className="w-12 h-16 object-cover scale-110 group-hover:scale-100 transition-transform duration-500"
              />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}