// src/components/HeroBanner.tsx
import { Bookmark, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface HeroBannerProps {
  anime: any;
  currentIndex: number;
  total: number;
  onNext?: () => void;
  onPrev?: () => void;
  onSelect?: (index: number) => void;
}

export default function HeroBanner({ anime, currentIndex, total, onNext, onPrev, onSelect }: HeroBannerProps) {
  const navigate = useNavigate();

  if (!anime) return null;

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#040404] group flex flex-col justify-center">
      {/* 🖼️ HIGH FIDELITY PANORAMIC ART: Scales content cleanly with soft transition zooms */}
      <img
        src={anime.bannerImage || anime.image}
        alt={anime.title}
        className="absolute inset-0 w-full h-full object-cover object-top opacity-100 transition-opacity duration-1000 animate-in fade-in zoom-in-105 duration-[3000ms]"
      />

      {/* 🔥 PREMIUM GRADIENT MATRIX: Dual-directional multi-stops ensuring text reads beautifully over detailed frames */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#040404] via-[#040404]/70 to-transparent z-10" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#040404] via-transparent via-[#040404]/20 to-[#040404]/40 z-10" />

      {/* Balanced layout structure perfectly mapped for maximum desktop scannability */}
      <div className="relative z-20 w-full flex flex-col justify-center px-12 max-w-4xl pt-16 pb-6 my-auto">

        <h1 className="text-4xl md:text-[52px] font-black mb-4 leading-[1.15] text-white drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)] tracking-tight font-['Oswald'] uppercase animate-in fade-in slide-in-from-left-8 duration-700 line-clamp-2 shrink-0 pb-1">
          {anime.title}
        </h1>

        <div className="flex items-center gap-4 mb-6 animate-in fade-in slide-in-from-left-6 duration-700 delay-200 shrink-0">
          <span className="bg-blue-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-600/50">
            {anime.subOrDub || "SUB | DUB"}
          </span>
          <span className="text-gray-200 font-bold text-xs tracking-wide bg-[#040404]/40 px-3 py-1.5 rounded-lg backdrop-blur-md border border-white/10">
            Rating: {anime.rating || "85"}%
          </span>
        </div>

        <p className="text-gray-200 text-sm mb-6 line-clamp-3 leading-relaxed max-w-xl font-medium drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] animate-in fade-in slide-in-from-left-4 duration-700 delay-300 shrink-0">
          {anime.description?.replace(/<[^>]*>/g, '') || "Experience the epic journey on KuroTV."}
        </p>

        <div className="flex items-center gap-4 pointer-events-auto animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500 shrink-0">
          <button
            onClick={() => navigate(`/anime/${anime.id}`)}
            className="bg-blue-600 hover:bg-blue-500 text-white font-black px-10 py-4 rounded-xl transition-all shadow-[0_15px_30px_-10px_rgba(59,130,246,0.6)] uppercase tracking-[0.2em] text-xs font-['Oswald'] tracking-widest cursor-pointer"
          >
            Watch Now
          </button>
          <button className="bg-[#040404]/40 hover:bg-[#040404]/60 text-white p-4 rounded-xl backdrop-blur-2xl border border-white/10 transition-all cursor-pointer">
            <Bookmark className="w-5 h-5 fill-current text-blue-500" />
          </button>
        </div>

        {/* INTERACTIVE INDICATOR DOTS */}
        <div className="flex items-center gap-4 mt-8 pointer-events-auto z-30 shrink-0">
          <div className="flex gap-1.5 flex-wrap max-w-md">
            {Array.from({ length: total }).map((_, i) => (
              <div
                key={i}
                onClick={() => onSelect && onSelect(i)}
                className={`h-1.5 rounded-full transition-all duration-700 shadow-lg cursor-pointer hover:bg-blue-400 ${i === currentIndex ? 'w-8 bg-blue-600 shadow-blue-600/50' : 'w-2 bg-white/20'
                  }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* MANUAL ARROW CONTROLS */}
      <div className="absolute bottom-8 right-12 z-30 flex items-center gap-2 pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <button
          onClick={onPrev}
          className="w-10 h-10 rounded-xl bg-[#040404]/60 backdrop-blur-md border border-white/10 hover:bg-blue-600 hover:border-blue-500 text-white flex items-center justify-center transition-all cursor-pointer shadow-lg"
          aria-label="Previous anime"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={onNext}
          className="w-10 h-10 rounded-xl bg-[#040404]/60 backdrop-blur-md border border-white/10 hover:bg-blue-600 hover:border-blue-500 text-white flex items-center justify-center transition-all cursor-pointer shadow-lg"
          aria-label="Next anime"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}