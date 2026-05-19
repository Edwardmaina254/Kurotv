import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, Star, Play, ArrowLeft } from 'lucide-react';

interface SearchResult {
    id: number;
    title: { english: string; romaji: string };
    coverImage: { extraLarge: string };
    averageScore: number;
    type: string;
    status: string;
}

export default function SearchResults() {
    const { query } = useParams<{ query: string }>();
    const navigate = useNavigate();
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSearchResults = async () => {
            setLoading(true);
            try {
                const gqlQuery = `query ($search: String) { Page(page: 1, perPage: 50) { media(search: $search, type: ANIME, sort: SEARCH_MATCH) { id title { english romaji } coverImage { extraLarge } averageScore type status } } }`;
                const response = await fetch('https://graphql.anilist.co', {
                    method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ query: gqlQuery, variables: { search: query } })
                });
                const data = await response.json();
                if (data.data?.Page?.media && query) {
                    const queryWords = query.toLowerCase().trim().split(/\s+/);
                    const strictResults = data.data.Page.media.filter((anime: SearchResult) => {
                        const engTitle = (anime.title.english || '').toLowerCase();
                        const romTitle = (anime.title.romaji || '').toLowerCase();
                        return queryWords.every(w => engTitle.includes(w)) || queryWords.every(w => romTitle.includes(w));
                    });
                    setResults(strictResults);
                }
            } catch (error) { console.error("Search failed:", error); }
            finally { setLoading(false); }
        };
        if (query) fetchSearchResults();
    }, [query]);

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-6 h-6 text-accent animate-spin" />
                <p className="text-xs text-muted font-semibold tracking-wider uppercase">Searching...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-24 pb-16 px-4 sm:px-8">
            <div className="max-w-[1400px] mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-surface border border-border flex items-center justify-center hover:border-muted hover:text-fg transition-all text-muted cursor-pointer shadow-sm">
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight font-display">Search Results</h1>
                        <p className="text-sm text-muted mt-0.5">Found {results.length} results for <span className="text-accent font-semibold">"{query}"</span></p>
                    </div>
                </div>

                {results.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
                        {results.map((anime) => {
                            const title = anime.title.english || anime.title.romaji;
                            return (
                                <div key={anime.id} onClick={() => navigate(`/anime/${anime.id}`)} className="group relative rounded-xl overflow-hidden cursor-pointer aspect-[2/3] border border-border hover:border-muted transition-all bg-surface" data-reveal>
                                    <img src={anime.coverImage.extraLarge} alt={title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" loading="lazy" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end pb-3 pl-3">
                                        <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center">
                                            <Play className="w-3.5 h-3.5 text-white ml-0.5 fill-current" />
                                        </div>
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                                        <h3 className="text-white text-sm font-semibold line-clamp-2 leading-tight">{title}</h3>
                                        <div className="flex items-center justify-between mt-1.5">
                                            <span className="text-[9px] font-semibold tracking-wider text-white/70 uppercase bg-black/30 px-1.5 py-0.5 rounded">{anime.type || "TV"}</span>
                                            {anime.averageScore && <div className="flex items-center gap-1"><Star className="w-3 h-3 text-accent fill-accent" /><span className="text-[10px] font-medium text-white/70">{anime.averageScore}</span></div>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="py-20 flex flex-col items-center justify-center border border-dashed border-border rounded-2xl bg-surface">
                        <p className="text-base font-semibold text-muted">No results found</p>
                        <p className="text-sm text-muted mt-1">Try a different search term.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
