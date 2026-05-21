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

const FilterDropdown = ({ label, value, options, onChange, isOpen, onToggle }: {
    label: string, value: string, options: { label: string, value: string }[], onChange: (val: string) => void, isOpen: boolean, onToggle: () => void
}) => (
    <div className="relative">
        <button onClick={onToggle} className="flex items-center justify-between min-w-[150px] bg-surface border border-border hover:border-muted hover:text-fg rounded-xl py-2 px-3.5 text-[11px] font-semibold tracking-wider text-muted transition-all cursor-pointer shadow-sm">
            <span className="truncate pr-2">{value ? options.find(o => o.value === value)?.label || label : label}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-accent' : 'text-muted'}`} />
        </button>
        {isOpen && (
            <div className="absolute top-[calc(100%+6px)] left-0 w-full min-w-[180px] bg-surface border border-border rounded-xl py-1.5 z-50 animate-float-in shadow-lg">
                <button onClick={() => onChange('')} className={`text-left text-[11px] font-semibold px-3.5 py-2 hover:bg-bg transition-colors w-full flex items-center justify-between ${!value ? 'text-accent' : 'text-muted hover:text-fg'}`}>
                    {label} {!value && <Check className="w-3 h-3" />}
                </button>
                {options.map((opt) => (
                    <button key={opt.value} onClick={() => onChange(opt.value)} className={`text-left text-[11px] font-semibold px-3.5 py-2 hover:bg-bg transition-colors w-full flex items-center justify-between ${value === opt.value ? 'text-accent' : 'text-muted hover:text-fg'}`}>
                        {opt.label} {value === opt.value && <Check className="w-3 h-3" />}
                    </button>
                ))}
            </div>
        )}
    </div>
);

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
            if (filtersRef.current && !filtersRef.current.contains(event.target as Node)) setOpenDropdown(null);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        const fetchSearchResults = async () => {
            if (page === 1) setLoading(true); else setIsFetchingMore(true);
            try {
                const searchStr = query ? query.trim() : undefined;
                const variables: any = { page, perPage: 24 };
                if (searchStr) variables.search = searchStr;
                if (genre) variables.genre = genre;
                if (format) variables.format = format;
                if (sort === 'trending') variables.sort = ["TRENDING_DESC"];
                else if (sort === 'popular') variables.sort = ["POPULARITY_DESC"];
                else if (sort === 'newest') variables.sort = ["START_DATE_DESC", "TRENDING_DESC"];
                else if (sort === 'score') variables.sort = ["SCORE_DESC", "TRENDING_DESC"];
                else variables.sort = ["TRENDING_DESC"];

                // 🔥 ADDED isAdult: false inside the media arguments
                const queryStr = `
                    query ($page: Int, $perPage: Int, $search: String, $genre: String, $format: MediaFormat, $sort: [MediaSort]) {
                        Page(page: $page, perPage: $perPage) {
                            pageInfo {
                                hasNextPage
                            }
                            media(search: $search, genre: $genre, format: $format, type: ANIME, sort: $sort, isAdult: false) {
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
                    method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ query: queryStr, variables })
                });
                if (!res.ok) throw new Error("Anilist API search failed");
                const data = await res.json();
                const pageInfo = data.data?.Page?.pageInfo;
                const media = data.data?.Page?.media || [];
                const newItems = media.map((anime: any) => ({
                    id: anime.id.toString(), title: anime.title?.english || anime.title?.romaji || 'Unknown',
                    image: anime.coverImage?.extraLarge || '', type: anime.type || 'TV',
                    status: anime.status || 'UNKNOWN', rating: anime.averageScore ? anime.averageScore : 0,
                    totalEpisodes: anime.episodes || 0, genres: anime.genres || []
                }));
                if (page === 1) setResults(newItems);
                else setResults(prev => { const existingIds = new Set(prev.map(item => item.id)); return [...prev, ...newItems.filter((item: any) => !existingIds.has(item.id))]; });
                setCanLoadMore(!!pageInfo?.hasNextPage);
            } catch (error) {
                console.warn("Search failed:", error);
                if (page === 1) setResults([]);
                setCanLoadMore(false);
            } finally {
                setLoading(false);
                setIsFetchingMore(false);
            }
        };
        const timerId = setTimeout(fetchSearchResults, 300);
        return () => clearTimeout(timerId);
    }, [query, genre, format, sort, page]);

    const updateFilter = (key: string, value: string) => {
        const newParams = new URLSearchParams(searchParams);
        if (value) newParams.set(key, value); else newParams.delete(key);
        setPage(1);
        setSearchParams(newParams);
        setOpenDropdown(null);
    };

    return (
        <div className="min-h-screen pt-24 pb-16 px-6 md:px-10">
            <div className="max-w-[1400px] mx-auto mb-8">
                <button onClick={() => navigate('/home')} className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-muted hover:text-fg uppercase transition-colors mb-5 cursor-pointer">
                    <ArrowLeft className="w-3.5 h-3.5" /> Go Back
                </button>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5" ref={filtersRef}>
                    <h1 className="text-2xl font-bold tracking-tight font-display">
                        {query ? <>Results for <span className="text-accent">"{query}"</span></> : "Discover Anime"}
                    </h1>
                    <div className="flex flex-wrap items-center gap-3">
                        <FilterDropdown label="All Genres" value={genre} options={GENRES} isOpen={openDropdown === 'genre'} onToggle={() => setOpenDropdown(openDropdown === 'genre' ? null : 'genre')} onChange={(val) => updateFilter('genre', val)} />
                        <FilterDropdown label="All Types" value={format} options={FORMATS} isOpen={openDropdown === 'format'} onToggle={() => setOpenDropdown(openDropdown === 'format' ? null : 'format')} onChange={(val) => updateFilter('format', val)} />
                        <FilterDropdown label="Sort By" value={sort} options={SORTS} isOpen={openDropdown === 'sort'} onToggle={() => setOpenDropdown(openDropdown === 'sort' ? null : 'sort')} onChange={(val) => updateFilter('sort', val)} />
                    </div>
                </div>
            </div>

            <div className="max-w-[1400px] mx-auto">
                {results.length === 0 && !loading ? (
                    <div className="flex flex-col items-center justify-center py-24 text-muted bg-surface rounded-2xl border border-border">
                        <Filter className="w-12 h-12 mb-4 opacity-20" />
                        <h2 className="text-lg font-bold tracking-tight">No Results Found</h2>
                        <p className="text-sm mt-2">Try adjusting your filters or search term.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-y-10 gap-x-5">
                        {results.map((anime) => (
                            <div key={anime.id} onClick={() => navigate(`/anime/${anime.id}?ep=1`)} className="group cursor-pointer" data-reveal>
                                <div className="aspect-[2/3] bg-surface rounded-xl overflow-hidden mb-2 border border-border relative">
                                    <img src={anime.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={anime.title} />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end pb-3 pl-3">
                                        <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center">
                                            <Play className="w-3.5 h-3.5 text-white fill-current ml-0.5" />
                                        </div>
                                    </div>
                                    <span className="absolute top-3 right-3 bg-black/60 text-white text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">{anime.type || "TV"}</span>
                                </div>
                                <h4 className="font-semibold text-xs text-fg truncate group-hover:text-accent transition-colors">{anime.title}</h4>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[10px] text-muted font-medium flex items-center gap-1"><Star className="w-3 h-3 text-accent fill-accent" /> {anime.rating > 0 ? anime.rating : 'N/A'}</span>
                                </div>
                            </div>
                        ))}
                        {loading && Array.from({ length: 12 }).map((_, i) => <div key={`skel-${i}`} className="aspect-[2/3] bg-border rounded-xl animate-pulse" />)}
                    </div>
                )}

                {canLoadMore && !loading && (
                    <div className="mt-12 flex justify-center">
                        <button onClick={() => setPage(p => p + 1)} disabled={isFetchingMore}
                            className="bg-surface border border-border hover:bg-surface hover:text-fg text-muted hover:border-muted px-10 py-3 rounded-xl font-semibold text-xs tracking-wider uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer shadow-sm hover:shadow-md">
                            {isFetchingMore ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading...</> : <>Load More <ChevronDown className="w-3.5 h-3.5" /></>}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
