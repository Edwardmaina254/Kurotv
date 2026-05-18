// src/pages/Search.tsx
import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Filter, Play, Star, ChevronDown, Check, ArrowLeft, Loader2 } from 'lucide-react';

interface SearchResult {
    id: string;
    title: string;
    image: string;
    type: string;
    status: string;
    rating: number;
    totalEpisodes: number;
    genres?: string[];
}

const FilterDropdown = ({
    label, value, options, onChange, isOpen, onToggle
}: {
    label: string, value: string, options: { label: string, value: string }[], onChange: (val: string) => void, isOpen: boolean, onToggle: () => void
}) => {
    return (
        <div className="relative">
            <button onClick={onToggle} className="flex items-center justify-between w-full min-w-[160px] bg-[var(--kuro-card)] border border-[#222] hover:border-[var(--kuro-blue)] hover:text-white rounded-lg py-2.5 px-4 text-xs font-bold uppercase tracking-widest text-gray-300 transition-all shadow-inner cursor-pointer group">
                <span className="truncate pr-2">{value ? options.find(o => o.value === value)?.label || label : label}</span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180 text-[var(--kuro-blue)]' : 'text-gray-500 group-hover:text-[var(--kuro-blue)]'}`} />
            </button>
            {isOpen && (
                <div className="absolute top-[calc(100%+8px)] left-0 w-full min-w-[200px] bg-[var(--kuro-card)] border border-[#222] rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.9)] py-2 z-50 flex flex-col max-h-[300px] overflow-y-auto custom-scrollbar ring-1 ring-white/5">
                    <button onClick={() => onChange('')} className={`text-left text-xs font-bold px-4 py-3 hover:bg-[#1a1a1a] transition-colors flex items-center justify-between cursor-pointer ${!value ? 'text-[var(--kuro-blue)]' : 'text-gray-400 hover:text-white'}`}>
                        {label} {!value && <Check className="w-3.5 h-3.5" />}
                    </button>
                    {options.map((opt) => (
                        <button key={opt.value} onClick={() => onChange(opt.value)} className={`text-left text-xs font-bold px-4 py-3 hover:bg-[#1a1a1a] transition-colors flex items-center justify-between cursor-pointer ${value === opt.value ? 'text-[var(--kuro-blue)]' : 'text-gray-400 hover:text-white'}`}>
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

    const [canLoadMore, setCanLoadMore] = useState(false);
    const [isFetchingMore, setIsFetchingMore] = useState(false);

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
            if (page === 1) setLoading(true);
            else setIsFetchingMore(true);

            try {
                const searchStr = query ? query.trim() : undefined;

                const variables: any = { page: page, perPage: 24 };
                if (searchStr) variables.search = searchStr;
                if (genre) variables.genre = genre;
                if (format) variables.format = format;

                if (sort === 'trending') variables.sort = ["TRENDING_DESC"];
                else if (sort === 'popular') variables.sort = ["POPULARITY_DESC"];
                else if (sort === 'newest') variables.sort = ["START_DATE_DESC", "TRENDING_DESC"];
                else if (sort === 'score') variables.sort = ["SCORE_DESC", "TRENDING_DESC"];
                else variables.sort = ["TRENDING_DESC"];

                const queryStr = `
                    query ($page: Int, $perPage: Int, $search: String, $genre: String, $format: MediaFormat, $sort: [MediaSort]) {
                        Page(page: $page, perPage: $perPage) {
                            pageInfo {
                                hasNextPage
                            }
                            media(search: $search, genre: $genre, format: $format, type: ANIME, sort: $sort) {
                                id
                                title { english romaji }
                                coverImage { extraLarge }
                                type
                                status
                                averageScore
                                episodes
                                genres
                            }
                        }
                    }
                `;

                const res = await fetch('https://graphql.anilist.co', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ query: queryStr, variables })
                });

                if (!res.ok) throw new Error("Anilist API search failed");
                const data = await res.json();
                
                const pageInfo = data.data?.Page?.pageInfo;
                const media = data.data?.Page?.media || [];

                const newItems = media.map((anime: any) => ({
                    id: anime.id.toString(),
                    title: anime.title?.english || anime.title?.romaji || 'Unknown',
                    image: anime.coverImage?.extraLarge || '',
                    type: anime.type || 'TV',
                    status: anime.status || 'UNKNOWN',
                    rating: anime.averageScore ? anime.averageScore : 0,
                    totalEpisodes: anime.episodes || 0,
                    genres: anime.genres || []
                }));

                if (page === 1) {
                    setResults(newItems);
                } else {
                    setResults(prev => {
                        const existingIds = new Set(prev.map(item => item.id));
                        const filteredNew = newItems.filter((item: any) => !existingIds.has(item.id));
                        return [...prev, ...filteredNew];
                    });
                }

                setCanLoadMore(!!pageInfo?.hasNextPage);

            } catch (error) {
                console.warn("Backend API gap detected. Falling back safely.", error);
                if (page === 1) setResults([]);
                setCanLoadMore(false);
            } finally {
                setLoading(false);
                setIsFetchingMore(false);
            }
        };

        const timerId = setTimeout(() => {
            fetchSearchResults();
        }, 300);

        return () => clearTimeout(timerId);
    }, [query, genre, format, sort, page]);

    const updateFilter = (key: string, value: string) => {
        const newParams = new URLSearchParams(searchParams);
        if (value) newParams.set(key, value);
        else newParams.delete(key);

        setPage(1); // Reset to page 1 on new filter
        setSearchParams(newParams);
        setOpenDropdown(null);
    };

    return (
        <div className="min-h-screen bg-[var(--kuro-bg)] text-white pt-24 pb-20 px-6 md:px-12">
            <div className="max-w-[1400px] mx-auto mb-10">
                <button onClick={() => navigate('/home')} className="flex items-center gap-2 text-[10px] font-black tracking-widest text-gray-500 hover:text-[var(--kuro-blue)] uppercase transition-colors mb-6 cursor-pointer group">
                    <ArrowLeft className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" /> Go Back
                </button>

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6" ref={filtersRef}>
                    <h1 className="text-3xl font-black uppercase tracking-widest">
                        {query ? <>Results for <span className="text-[var(--kuro-blue)] drop-shadow-md">"{query}"</span></> : "Discover Anime"}
                    </h1>

                    <div className="flex flex-wrap items-center gap-4">
                        <FilterDropdown label="All Genres" value={genre} options={GENRES} isOpen={openDropdown === 'genre'} onToggle={() => setOpenDropdown(openDropdown === 'genre' ? null : 'genre')} onChange={(val) => updateFilter('genre', val)} />
                        <FilterDropdown label="All Types" value={format} options={FORMATS} isOpen={openDropdown === 'format'} onToggle={() => setOpenDropdown(openDropdown === 'format' ? null : 'format')} onChange={(val) => updateFilter('format', val)} />
                        <FilterDropdown label="Sort By" value={sort} options={SORTS} isOpen={openDropdown === 'sort'} onToggle={() => setOpenDropdown(openDropdown === 'sort' ? null : 'sort')} onChange={(val) => updateFilter('sort', val)} />
                    </div>
                </div>
            </div>

            <div className="max-w-[1400px] mx-auto">
                {results.length === 0 && !loading ? (
                    <div className="flex flex-col items-center justify-center py-24 text-gray-500 bg-[var(--kuro-card)] rounded-2xl border border-[#111] shadow-2xl">
                        <Filter className="w-16 h-16 mb-6 opacity-20" />
                        <h2 className="text-2xl font-black uppercase tracking-widest text-gray-400">No Results Found</h2>
                        <p className="text-sm font-bold mt-3 text-gray-600">Try adjusting your filters or search term.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-y-10 gap-x-6">
                        {results.map((anime) => (
                            <div key={anime.id} onClick={() => navigate(`/anime/${anime.id}?ep=1`)} className="group cursor-pointer relative block">
                                <div className="aspect-[2/3] bg-[var(--kuro-card)] rounded-[20px] overflow-hidden mb-3 border border-white/5 group-hover:border-[var(--kuro-blue)]/50 transition-all duration-500 shadow-2xl relative">
                                    <img src={anime.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={anime.title} />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                        <div className="w-12 h-12 bg-[var(--kuro-blue)] rounded-full flex items-center justify-center transform scale-75 group-hover:scale-100 transition-transform duration-300 shadow-[0_0_30px_var(--kuro-blue)]">
                                            <Play className="w-5 h-5 text-white fill-current ml-1" />
                                        </div>
                                    </div>
                                    <div className="absolute top-3 right-3 bg-[var(--kuro-blue)] text-[10px] font-black px-2 py-1 rounded-lg uppercase shadow-lg z-20">
                                        {anime.type || "TV"}
                                    </div>
                                </div>
                                <h4 className="font-bold text-xs truncate text-gray-300 group-hover:text-[var(--kuro-blue)] transition-all duration-300 px-1">{anime.title}</h4>
                                <div className="flex items-center gap-2 mt-1 px-1">
                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest flex items-center gap-1">
                                        <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" /> {anime.rating > 0 ? anime.rating : 'N/A'}
                                    </span>
                                </div>
                            </div>
                        ))}

                        {/* Skeleton loaders show alongside loaded items when fetching */}
                        {loading && Array.from({ length: 12 }).map((_, i) => (
                            <div key={`skel-${i}`} className="aspect-[2/3] bg-[var(--kuro-card)] rounded-[20px] animate-pulse border border-[#222]" />
                        ))}
                    </div>
                )}

                {/* LOAD MORE BUTTON STYLED WITH THEME VARIABLES */}
                {canLoadMore && !loading && (
                    <div className="mt-16 flex justify-center">
                        <button
                            onClick={() => setPage(p => p + 1)}
                            disabled={isFetchingMore}
                            className="bg-[var(--kuro-card)] hover:bg-[var(--kuro-blue)] border border-[#222] hover:border-[var(--kuro-blue)] text-white px-12 py-4 rounded-xl font-black tracking-widest uppercase text-xs transition-all duration-300 shadow-[0_10px_30px_rgba(0,0,0,0.8)] hover:shadow-[0_10px_40px_var(--kuro-blue)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 group"
                        >
                            {isFetchingMore ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Loading...
                                </>
                            ) : (
                                <>
                                    Load More Anime
                                    <ChevronDown className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}