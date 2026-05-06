// src/components/HeroBanner.tsx
import { ChevronLeft, ChevronRight, Bookmark } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface HeroBannerProps {
  anime: any;
  currentIndex: number;
  total: number;
  onNext: () => void;
  onPrev: () => void;
}

export default function HeroBanner({ anime, currentIndex, total, onNext, onPrev }: HeroBannerProps) {
  const navigate = useNavigate(); // Navigation Hook!

  if (!anime) return null;

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#040404]">
      <img
        src={anime.bannerImage || anime.image}
        alt={anime.title}
        className="absolute inset-0 w-full h-full object-cover object-top opacity-100 transition-opacity duration-1000 animate-in fade-in zoom-in-105 duration-[3000ms]"
      />

      <div className="absolute inset-0 bg-gradient-to-r from-[#040404] via-[#040404]/60 to-transparent z-10" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#040404] via-transparent to-transparent z-10" />

      {/* Added pt-24 here to push the text down so it NEVER kisses the Navbar */}
      <div className="relative z-20 h-full flex flex-col justify-center px-12 max-w-4xl pt-24 pb-8">

        <h1 className="text-5xl md:text-[55px] font-black mb-3 leading-[1.1] text-white drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)] tracking-tight font-['Oswald'] uppercase animate-in fade-in slide-in-from-left-8 duration-700 line-clamp-2">
          {anime.title}
        </h1>

        <div className="flex items-center gap-4 mb-6 animate-in fade-in slide-in-from-left-6 duration-700 delay-200">
          <span className="bg-blue-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-600/50">
            {anime.subOrDub || "SUB | DUB"}
          </span>
          <span className="text-gray-200 font-bold text-xs tracking-wide bg-[#040404]/40 px-3 py-1.5 rounded-lg backdrop-blur-md border border-white/10">
            Rating: {anime.rating || "85"}%
          </span>
        </div>

        <p className="text-gray-200 text-sm mb-6 line-clamp-3 leading-relaxed max-w-xl font-medium drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] animate-in fade-in slide-in-from-left-4 duration-700 delay-300">
          {anime.description?.replace(/<[^>]*>/g, '') || "Experience the epic journey on KuroTV."}
        </p>

        <div className="flex items-center gap-4 pointer-events-auto animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
          {/* WIRED UP: Button now navigates to the Anime Details page */}
          <button
            onClick={() => navigate(`/anime/${anime.id}`)}
            className="bg-blue-600 hover:bg-blue-500 text-white font-black px-10 py-4 rounded-xl transition-all shadow-[0_15px_30px_-10px_rgba(59,130,246,0.6)] uppercase tracking-[0.2em] text-xs font-['Oswald'] tracking-widest"
          >
            Watch Now
          </button>
          <button className="bg-[#040404]/40 hover:bg-[#040404]/60 text-white p-4 rounded-xl backdrop-blur-2xl border border-white/10 transition-all">
            <Bookmark className="w-5 h-5 fill-current text-blue-500" />
          </button>
        </div>

        <div className="flex items-center gap-4 mt-8 pointer-events-auto">
          <div className="flex gap-1.5 flex-wrap max-w-md">
            {Array.from({ length: total }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-700 shadow-lg ${i === currentIndex ? 'w-8 bg-blue-600 shadow-blue-600/50' : 'w-2 bg-white/20'
                  }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}