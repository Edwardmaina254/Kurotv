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
    <div className="relative w-full h-full overflow-hidden bg-bg parallax-container group">
      {/* Blurred background layer — Animekai-style: fills edges when aspect ratio doesn't match */}
      <div className="absolute inset-0 w-full h-full overflow-hidden">
        <img
          src={anime.bannerImage || anime.image}
          alt=""
          className="w-full h-full object-cover object-center scale-110 blur-2xl opacity-60"
          aria-hidden="true"
        />
      </div>

      {/* Foreground image — top-aligned to show faces, not bodies */}
      <img
        src={anime.bannerImage || anime.image}
        alt={anime.title}
        className="absolute inset-0 w-full h-full object-cover object-top parallax-bg"
      />

      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent z-10" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10" />

      <div className="relative z-20 w-full flex flex-col justify-center px-10 max-w-3xl pt-16 pb-6 my-auto h-full">
        <div data-reveal className="mb-6">
          <span className="inline-block bg-accent/15 text-accent text-[10px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-4">
            {anime.subOrDub || "SUB | DUB"}
          </span>
        </div>

        <h1 data-reveal data-reveal-delay="100" className="text-3xl md:text-[48px] font-bold mb-4 leading-[1.05] text-fg tracking-tight font-display line-clamp-2">
          {anime.title}
        </h1>

        <p data-reveal data-reveal-delay="200" className="text-fg/80 text-sm mb-6 line-clamp-3 leading-relaxed max-w-xl">
          {anime.description?.replace(/<[^>]*>/g, '') || ""}
        </p>

        <div data-reveal data-reveal-delay="300" className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/anime/${anime.id}`)}
            className="bg-accent hover:bg-accent-dim text-white font-semibold px-8 py-3 rounded-xl transition-all text-xs uppercase tracking-wider cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
          >
            Watch Now
          </button>
          <button className="bg-surface border border-border hover:border-muted text-muted hover:text-fg p-3 rounded-xl transition-all cursor-pointer hover:-translate-y-0.5 active:translate-y-0 shadow-sm">
            <Bookmark className="w-4 h-4" />
          </button>
        </div>

        <div data-reveal data-reveal-delay="400" className="flex items-center gap-2 mt-8">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              onClick={() => onSelect && onSelect(i)}
              className={`h-1.5 rounded-full transition-all duration-500 cursor-pointer ${i === currentIndex ? 'w-8 bg-accent' : 'w-1.5 bg-border hover:bg-muted'}`}
            />
          ))}
        </div>
      </div>

      <div className="absolute bottom-6 right-6 z-30 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <button onClick={onPrev} className="w-11 h-11 rounded-xl bg-surface/70 backdrop-blur-md border border-border hover:border-accent text-muted hover:text-accent flex items-center justify-center transition-all cursor-pointer hover:scale-110 active:scale-95 shadow-lg" aria-label="Previous">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button onClick={onNext} className="w-11 h-11 rounded-xl bg-surface/70 backdrop-blur-md border border-border hover:border-accent text-muted hover:text-accent flex items-center justify-center transition-all cursor-pointer hover:scale-110 active:scale-95 shadow-lg" aria-label="Next">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
