// src/pages/SearchResults.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, Star, Play, ArrowLeft } from 'lucide-react';

interface SearchResult {
    id: number;
    title: {
        english: string;
        romaji: string;
    };
    coverImage: {
        extraLarge: string;
    };
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
                // 🛑 Increased perPage to 50 so we have plenty of results to strictly filter
                const gqlQuery = `
                query ($search: String) {
                    Page(page: 1, perPage: 50) {
                        media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
                            id
                            title { english romaji }
                            coverImage { extraLarge }
                            averageScore
                            type
                            status
                        }
                    }
                }`;

                const response = await fetch('https://graphql.anilist.co', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    body: JSON.stringify({
                        query: gqlQuery,
                        variables: { search: query }
                    })
                });

                const data = await response.json();

                if (data.data?.Page?.media && query) {
                    const rawResults = data.data.Page.media;
                    const queryWords = query.toLowerCase().trim().split(/\s+/);

                    // 🛑 THE STRICT TITLE FILTER: Destroys irrelevant AniList tag matches
                    const strictResults = rawResults.filter((anime: SearchResult) => {
                        const engTitle = (anime.title.english || '').toLowerCase();
                        const romTitle = (anime.title.romaji || '').toLowerCase();

                        // Require EVERY word typed to be in either the English or Romaji title
                        const matchesEng = queryWords.every(w => engTitle.includes(w));
                        const matchesRom = queryWords.every(w => romTitle.includes(w));

                        return matchesEng || matchesRom;
                    });

                    setResults(strictResults);
                }
            } catch (error) {
                console.error("Search failed:", error);
            } finally {
                setLoading(false);
            }
        };

        if (query) {
            fetchSearchResults();
        }
    }, [query]);

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-black gap-4">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                <p className="text-gray-500 font-bold tracking-widest uppercase text-xs">Scanning Database...</p>
            </div>
        );
    }

    return (
        <div className="w-full min-h-screen bg-black text-gray-300 font-sans pb-24 pt-28 px-4 sm:px-8">
            <div className="max-w-[1400px] mx-auto">

                {/* Header Section */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => navigate(-1)}
                        className="w-10 h-10 rounded-full bg-[#111] border border-[#222] flex items-center justify-center hover:bg-blue-600 hover:border-blue-500 hover:text-white transition-all text-gray-400"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-white uppercase tracking-tight">
                            Search Results
                        </h1>
                        <p className="text-sm text-gray-500 mt-1 font-medium">
                            Found {results.length} highly relevant results for <span className="text-blue-500 font-bold">"{query}"</span>
                        </p>
                    </div>
                </div>

                {/* Results Grid */}
                {results.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-6">
                        {results.map((anime) => {
                            const title = anime.title.english || anime.title.romaji;
                            return (
                                <div
                                    key={anime.id}
                                    onClick={() => navigate(`/anime/${anime.id}`)}
                                    className="group relative rounded-xl overflow-hidden cursor-pointer aspect-[2/3] border border-[#111] hover:border-blue-500 transition-all duration-300 shadow-lg bg-[#050505]"
                                >
                                    <img
                                        src={anime.coverImage.extraLarge}
                                        alt={title}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                                        loading="lazy"
                                    />

                                    {/* Play Overlay */}
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                        <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.5)]">
                                            <Play className="w-5 h-5 text-white ml-1" />
                                        </div>
                                    </div>

                                    {/* Info Gradient Bottom */}
                                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/80 to-transparent">
                                        <h3 className="text-white font-bold text-sm line-clamp-2 leading-tight group-hover:text-blue-400 transition-colors">
                                            {title}
                                        </h3>
                                        <div className="flex items-center justify-between mt-2">
                                            <span className="text-[10px] font-black tracking-widest text-gray-400 uppercase bg-[#111] px-2 py-0.5 rounded border border-[#222]">
                                                {anime.type || "TV"}
                                            </span>
                                            {anime.averageScore && (
                                                <div className="flex items-center gap-1">
                                                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                                    <span className="text-xs font-bold text-gray-300">{anime.averageScore}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="w-full py-20 flex flex-col items-center justify-center border border-dashed border-[#222] rounded-xl bg-[#050505]">
                        <p className="text-xl font-bold text-gray-400">No anime found matching your query.</p>
                        <p className="text-sm text-gray-600 mt-2">Try searching for a different title or check your spelling.</p>
                    </div>
                )}
            </div>
        </div>
    );
}