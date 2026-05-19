import { useNavigate } from 'react-router-dom';

export default function AnimeCard({ anime }: { anime: any }) {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.ctrlKey || e.metaKey || e.button === 1) return;
    e.preventDefault();
    navigate(`/anime/${anime.id}`);
  };

  return (
    <a href={`/anime/${anime.id}`} onClick={handleClick} className="group cursor-pointer w-full block" data-reveal>
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-border transition-all duration-500 bg-surface tilt-card group-hover:shadow-lg group-hover:-translate-y-1">
        <img
          src={anime.image}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
          alt={anime.title}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <span className="absolute top-3 right-3 bg-black/60 text-white text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0">
          {anime.subOrDub || "SUB"}
        </span>
      </div>
      <div className="mt-3 px-0.5">
        <h4 className="font-semibold text-sm truncate text-fg group-hover:text-accent transition-colors">
          {anime.title}
        </h4>
        <div className="flex items-center gap-2 mt-1 text-[10px] font-medium text-muted uppercase tracking-wider">
          <span>TV Series</span>
          <span className="w-0.5 h-0.5 rounded-full bg-border" />
          <span>{anime.releaseDate || "2026"}</span>
        </div>
      </div>
    </a>
  );
}
