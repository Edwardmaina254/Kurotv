// src/pages/Search.tsx
import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Filter, Play, Star, ChevronDown, Check, ArrowLeft } from 'lucide-react';

interface SearchResult {
    id: string;
    title: string;
    image: string;
    type: string;
    status: string;
    rating: number;
    totalEpisodes: number;
}

const FilterDropdown = ({
    label,
    value,
    options,
    onChange,
    isOpen,
    onToggle
}: {
    label: string,
    value: string,
    options: { label: string, value: string }[],
    onChange: (val: string) => void,
    isOpen: boolean,
    onToggle: () => void
}) => {
    return (
        <div className="relative">
            <button
                onClick={onToggle}
                className="flex items-center justify-between w-full min-w-[160px] bg-[#111] border border-[#222] hover:border-[#333] rounded-lg py-2.5 px-4 text-xs font-bold uppercase tracking-widest text-gray-300 transition-colors shadow-inner"
            >
                <span className="truncate pr-2">
                    {value ? options.find(o => o.value === value)?.label || label : label}
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180 text-blue-500' : 'text-gray-500'}`} />
            </button>

            {isOpen && (
                <div className="absolute top-[calc(100%+8px)] left-0 w-full min-w-[200px] bg-[#0a0a0a] border border-[#222] rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] py-2 z-50 flex flex-col max-h-[300px] overflow-y-auto custom-scrollbar">
                    <button
                        onClick={() => onChange('')}
                        className={`text-left text-xs font-bold px-4 py-3 hover:bg-[#1a1a1a] transition-colors flex items-center justify-between ${!value ? 'text-blue-500' : 'text-gray-400 hover:text-white'}`}
                    >
                        {label} {!value && <Check className="w-3.5 h-3.5" />}
                    </button>
                    {options.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => onChange(opt.value)}
                            className={`text-left text-xs font-bold px-4 py-3 hover:bg-[#1a1a1a] transition-colors flex items-center justify-between ${value === opt.value ? 'text-blue-500' : 'text-gray-400 hover:text-white'}`}
                        >
                            {opt.label} {value === opt.value && <Check className="w-3.5 h-3.5" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default function Search() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasNextPage, setHasNextPage] = useState(false);

    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const filtersRef = useRef<HTMLDivElement>(null);

    const query = searchParams.get('q') || '';
    const genre = searchParams.get('genre') || '';
    const format = searchParams.get('format') || '';
    const sort = searchParams.get('sort') || 'trending';

    const GENRES = ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Mecha", "Music", "Mystery", "Psychological", "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller"].map(g => ({ label: g, value: g }));
    const FORMATS = [{ label: "TV Series", value: "TV" }, { label: "Movie", value: "MOVIE" }, { label: "OVA", value: "OVA" }, { label: "ONA", value: "ONA" }, { label: "Special", value: "SPECIAL" }];
    const SORTS = [{ label: "Trending Now", value: "trending" }, { label: "Most Popular", value: "popular" }, { label: "Newest First", value: "newest" }, { label: "Highest Rated", value: "score" }];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filtersRef.current && !filtersRef.current.contains(event.target as Node)) {
                setOpenDropdown(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        const fetchSearchResults = async () => {
            setLoading(true);
            try {
                let url = `https://kurotv-production-9a26.up.railway.app/anime/zoro/search?page=${page}&sort=${sort}`;
                if (query) url += `&q=${encodeURIComponent(query)}`;
                if (genre) url += `&genres=${encodeURIComponent(genre)}`;
                if (format) url += `&format=${encodeURIComponent(format)}`;

                const res = await fetch(url);
                const data = await res.json();

                if (page === 1) {
                    setResults(data.results || []);
                } else {
                    setResults(prev => [...prev, ...(data.results || [])]);
                }
                setHasNextPage(data.hasNextPage);
            } catch (error) {
                console.error("Search failed:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchSearchResults();
    }, [query, genre, format, sort, page]);

    const updateFilter = (key: string, value: string) => {
        const newParams = new URLSearchParams(searchParams);
        if (value) newParams.set(key, value);
        else newParams.delete(key);

        setPage(1);
        setSearchParams(newParams);
        setOpenDropdown(null);
    };

    // 馃洃 UPDATED: Now redirects specifically to the /home dashboard
    const handleBack = () => {
        navigate('/home');
    };

    return (
        <div className="min-h-screen bg-[#040404] text-white pt-24 pb-20 px-6 md:px-12">

            <div className="max-w-[1400px] mx-auto mb-10">
                <button
                    onClick={handleBack}
                    className="flex items-center gap-2 text-[10px] font-black tracking-widest text-gray-500 hover:text-blue-500 uppercase transition-colors mb-6"
                >
                    <ArrowLeft className="w-4 h-4" /> Go Back
                </button>

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6" ref={filtersRef}>
                    <h1 className="text-3xl font-black uppercase tracking-widest">
                        {query ? (
                            <>Results for <span className="text-blue-500">"{query}"</span></>
                        ) : (
                            "Discover Anime"
                        )}
                    </h1>

                    <div className="flex flex-wrap items-center gap-4">
                        <FilterDropdown
                            label="All Genres"
                            value={genre}
                            options={GENRES}
                            isOpen={openDropdown === 'genre'}
                            onToggle={() => setOpenDropdown(openDropdown === 'genre' ? null : 'genre')}
                            onChange={(val) => updateFilter('genre', val)}
                        />
                        <FilterDropdown
                            label="All Types"
                            value={format}
                            options={FORMATS}
                            isOpen={openDropdown === 'format'}
                            onToggle={() => setOpenDropdown(openDropdown === 'format' ? null : 'format')}
                            onChange={(val) => updateFilter('format', val)}
                        />
                        <FilterDropdown
                            label="Sort By"
                            value={sort}
                            options={SORTS}
                            isOpen={openDropdown === 'sort'}
                            onToggle={() => setOpenDropdown(openDropdown === 'sort' ? null : 'sort')}
                            onChange={(val) => updateFilter('sort', val)}
                        />
                    </div>
                </div>
            </div>

            <div className="max-w-[1400px] mx-auto">
                {results.length === 0 && !loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                        <Filter className="w-12 h-12 mb-4 opacity-20" />
                        <h2 className="text-xl font-black uppercase tracking-widest">No Results Found</h2>
                        <p className="text-sm font-bold mt-2">Try adjusting your filters or search term.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-y-10 gap-x-6">
                        {results.map((anime) => (
                            <div key={anime.id} onClick={() => navigate(`/anime/${anime.id}`)} className="group cursor-pointer relative">
                                <div className="aspect-[2/3] bg-[#0a0a0a] rounded-[20px] overflow-hidden mb-3 border border-white/5 group-hover:border-blue-500/50 transition-all duration-500 shadow-2xl relative">
                                    <img src={anime.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={anime.title} />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                        <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center transform scale-75 group-hover:scale-100 transition-transform duration-300 shadow-[0_0_30px_rgba(37,99,235,0.6)]">
                                            <Play className="w-5 h-5 text-white fill-current ml-1" />
                                        </div>
                                    </div>
                                    <div className="absolute top-3 right-3 bg-blue-600 text-[10px] font-black px-2 py-1 rounded-lg uppercase shadow-lg z-20">
                                        {anime.type || "TV"}
                                    </div>
                                </div>
                                <h4 className="font-bold text-xs truncate text-gray-300 group-hover:text-blue-400 transition-all duration-300 px-1">{anime.title}</h4>
                                <div className="flex items-center gap-2 mt-1 px-1">
                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-1">
                                        <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" /> {anime.rating > 0 ? anime.rating : 'N/A'}
                                    </span>
                                </div>
                            </div>
                        ))}

                        {loading && Array.from({ length: 12 }).map((_, i) => (
                            <div key={`skel-${i}`} className="aspect-[2/3] bg-white/5 rounded-[20px] animate-pulse" />
                        ))}
                    </div>
                )}

                {hasNextPage && !loading && (
                    <div className="mt-16 flex justify-center">
                        <button
                            onClick={() => setPage(p => p + 1)}
                            className="bg-[#111] hover:bg-blue-600 border border-[#222] hover:border-blue-500 text-white px-10 py-3.5 rounded-lg font-black tracking-widest uppercase text-xs transition-all shadow-xl"
                        >
                            Load More Anime
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}