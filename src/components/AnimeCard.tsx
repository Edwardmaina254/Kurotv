// src/components/AnimeCard.tsx
export default function AnimeCard({ anime }: { anime: any }) {
    return (
      <div className="group cursor-pointer w-full">
        <div className="relative aspect-[2/3] rounded-[24px] overflow-hidden border border-white/5 group-hover:border-blue-500/50 transition-all duration-500 shadow-2xl">
          <img 
            src={anime.image} 
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
            alt={anime.title}
          />
          
          {/* Overlay Tags */}
          <div className="absolute top-3 right-3 flex flex-col gap-2">
            <div className="bg-blue-600 text-[9px] font-black px-2 py-1 rounded-lg shadow-xl uppercase">
              {anime.subOrDub || "SUB"}
            </div>
          </div>
  
          {/* Hover Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </div>
        
        <div className="mt-4 px-1">
          <h4 className="font-bold text-[15px] truncate text-gray-300 group-hover:text-blue-400 transition-all duration-300">
            {anime.title}
          </h4>
          <div className="flex items-center gap-2 mt-1.5 text-[10px] font-bold text-gray-600 uppercase tracking-widest">
            <span>TV Series</span>
            <span className="w-1 h-1 rounded-full bg-gray-800" />
            <span>{anime.releaseDate || "2026"}</span>
          </div>
        </div>
      </div>
    );
  }