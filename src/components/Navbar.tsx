// src/components/Navbar.tsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Search, Filter, Loader2, Star, User, LogOut, LayoutDashboard, Bookmark } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface QuickResult {
  id: number;
  title: { english: string; romaji: string };
  coverImage: { extraLarge: string };
  type: string;
  averageScore: number;
}

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');

  // Live Search State
  const [liveResults, setLiveResults] = useState<QuickResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // User Auth State
  const [user, setUser] = useState<any>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // 🛑 AUTHENTICATION LISTENER
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (error) {
      console.error('Error signing in:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setShowProfileMenu(false);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // 🛑 SYNC SEARCH BAR WITH URL
  useEffect(() => {
    if (location.pathname === '/search') {
      const params = new URLSearchParams(location.search);
      const q = params.get('q');
      if (q) setSearchQuery(q);
      setShowDropdown(false);
    } else {
      setSearchQuery('');
      setShowDropdown(false);
    }
  }, [location.pathname, location.search]);

  // THE LIVE SEARCH DEBOUNCE ENGINE
  useEffect(() => {
    if (!searchQuery.trim()) {
      setLiveResults([]);
      setShowDropdown(false);
      return;
    }

    const isOnSearchPage = location.pathname === '/search';
    const params = new URLSearchParams(location.search);
    const queryFromUrl = isOnSearchPage ? (params.get('q') || '') : '';

    if (isOnSearchPage && searchQuery === queryFromUrl) return;

    const timer = setTimeout(async () => {
      setIsSearching(true);
      setShowDropdown(true);

      try {
        // 1. PRIMARY SEARCH: Jikan (MAL)
        const jikanRes = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(searchQuery.trim())}&limit=5`);
        const jikanData = await jikanRes.json();

        if (jikanData?.data && jikanData.data.length > 0) {
          // Map Jikan data to match your existing AniList UI structure
          const mappedResults = jikanData.data.map(anime => ({
            id: anime.mal_id,
            title: {
              english: anime.title_english || anime.title,
              romaji: anime.title_japanese || anime.title
            },
            coverImage: {
              extraLarge: anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url
            },
            type: anime.type?.toUpperCase() || 'TV',
            averageScore: anime.score ? anime.score * 10 : 0 // Normalizing 0-10 to 0-100
          }));

          setLiveResults(mappedResults);
          return; // Exit if Jikan succeeds
        }

        // 2. SECONDARY SEARCH: AniList (Fallback if Jikan is empty or fails)
        const gqlQuery = `
        query ($search: String) {
          Page(page: 1, perPage: 5) {
            media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
              id
              title { english romaji }
              coverImage { extraLarge }
              type
              averageScore
            }
          }
        }
      `;

        const alResponse = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ query: gqlQuery, variables: { search: searchQuery.trim() } })
        });

        const alData = await alResponse.json();
        if (alData.data?.Page?.media) {
          setLiveResults(alData.data.Page.media);
        }

      } catch (error) {
        console.error("Live search failed:", error);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, location.pathname, location.search]);

  // CLOSE DROPDOWNS ON OUTSIDE CLICK
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setShowDropdown(false);
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleResultClick = (id: number) => {
    setShowDropdown(false);
    setSearchQuery('');
    navigate(`/anime/${id}`);
  };

  const handleRandom = async () => {
    try {
      const randomPage = Math.floor(Math.random() * 100) + 1;
      const gqlQuery = `
        query {
          Page(page: ${randomPage}, perPage: 50) {
            media(type: ANIME, sort: POPULARITY_DESC) {
              id
            }
          }
        }
      `;
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query: gqlQuery })
      });
      const data = await response.json();
      if (data.data?.Page?.media?.length > 0) {
        const mediaArray = data.data.Page.media;
        const randomIndex = Math.floor(Math.random() * mediaArray.length);
        navigate(`/anime/${mediaArray[randomIndex].id}`);
      }
    } catch (err) {
      console.error("Failed to fetch random anime", err);
    }
  };

  const GENRES = ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Mecha", "Music", "Mystery", "Psychological", "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller"];
  const TYPES = [{ label: "Movies", value: "MOVIE" }, { label: "TV Series", value: "TV" }, { label: "OVAs", value: "OVA" }, { label: "ONAs", value: "ONA" }, { label: "Specials", value: "SPECIAL" }];

  if (location.pathname === '/') {
    return null;
  }

  return (
    <nav className="flex items-center justify-between px-10 py-4 bg-[#040404]/90 backdrop-blur-2xl sticky top-0 z-50 border-b border-white/5 shadow-2xl">
      <div className="flex items-center gap-2">
        <Link
          to="/home"
          onClick={() => setSearchQuery('')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          {/* ⚡ LOGO REMOVED: Just minimalist text now */}
          <span className="text-3xl font-black tracking-tight text-white italic font-['Oswald'] drop-shadow-md transition-colors group-hover:text-blue-500">
            KURO<span className="text-blue-600">TV</span>
          </span>
        </Link>
      </div>

      <div className="flex-1 max-w-2xl px-12 relative" ref={dropdownRef}>
        <form onSubmit={handleSearch} className="relative flex items-center w-full bg-white/5 rounded-2xl px-5 py-2.5 border border-white/10 focus-within:border-blue-500/50 focus-within:bg-white/10 transition-all duration-300 shadow-inner z-50">
          <Search className="w-4 h-4 text-gray-400 mr-3" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onFocus={() => { if (searchQuery.trim() && liveResults.length > 0) setShowDropdown(true); }} placeholder="Search anime..." className="bg-transparent border-none outline-none text-sm w-full placeholder-gray-500 text-white font-medium" />
          {isSearching && <Loader2 className="w-4 h-4 text-blue-500 animate-spin absolute right-20" />}
          <button type="button" onClick={() => navigate('/search')} className="flex items-center text-[10px] font-black tracking-widest text-gray-400 ml-2 hover:text-blue-500 transition-colors uppercase bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-lg cursor-pointer z-50">
            <Filter className="w-3 h-3 mr-1.5" /> Filter
          </button>
        </form>

        {showDropdown && searchQuery.trim().length > 0 && (
          <div className="absolute top-[120%] left-12 right-12 bg-[#0a0a0a] border border-[#222] rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden z-40 flex flex-col">
            {isSearching && liveResults.length === 0 ? (
              <div className="p-6 flex justify-center"><Loader2 className="w-6 h-6 text-blue-600 animate-spin" /></div>
            ) : liveResults.length > 0 ? (
              <>
                <div className="flex flex-col">
                  {liveResults.map((anime) => (
                    <div key={anime.id} onClick={() => handleResultClick(anime.id)} className="flex items-center gap-4 p-3 hover:bg-[#1a1a1a] transition-colors cursor-pointer border-b border-[#111] last:border-0">
                      <img src={anime.coverImage.extraLarge} alt={anime.title.english || anime.title.romaji} className="w-10 h-14 object-cover rounded-md shadow-sm" />
                      <div className="flex flex-col flex-1">
                        <span className="text-sm font-bold text-white line-clamp-1">{anime.title.english || anime.title.romaji}</span>
                        <div className="flex items-center gap-3 mt-1 text-[10px] font-bold text-gray-500 tracking-widest uppercase">
                          <span>{anime.type || "TV"}</span>
                          {anime.averageScore && <span className="flex items-center gap-1 text-gray-400"><Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />{anime.averageScore}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={handleSearch} className="w-full py-3 bg-[#111] hover:bg-blue-600 hover:text-white transition-colors text-xs font-black tracking-widest uppercase text-gray-400 border-t border-[#222]">View all results</button>
              </>
            ) : <div className="p-6 text-center text-sm font-bold text-gray-500">No instant results found.</div>}
          </div>
        )}
      </div>

      {/* NAV LINKS */}
      <div className="flex items-center gap-6 text-[12px] font-bold tracking-widest text-gray-400 uppercase">
        <button onClick={handleRandom} className="hover:text-white transition-colors cursor-pointer">Random</button>
        <div className="relative group py-4">
          <button className="hover:text-white transition-colors cursor-pointer">Genres</button>
          <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
            <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-5 shadow-[0_10px_40px_rgba(0,0,0,0.8)] w-[450px]">
              <div className="grid grid-cols-3 gap-y-4 gap-x-2">
                {GENRES.map((genre) => <button key={genre} onClick={() => navigate(`/search?genre=${genre}`)} className="text-left text-[11px] hover:text-blue-400 transition-colors">{genre}</button>)}
              </div>
            </div>
          </div>
        </div>

        <div className="relative group py-4">
          <button className="hover:text-white transition-colors cursor-pointer">Types</button>
          <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
            <div className="bg-[#0a0a0a] border border-[#222] rounded-xl py-3 w-[150px] shadow-[0_10px_40px_rgba(0,0,0,0.8)] flex flex-col">
              {TYPES.map((type) => <button key={type.value} onClick={() => navigate(`/search?format=${type.value}`)} className="text-left text-[11px] hover:bg-[#1a1a1a] hover:text-blue-400 transition-colors px-5 py-2.5">{type.label}</button>)}
            </div>
          </div>
        </div>

        <button onClick={() => navigate('/search?status=RELEASING&sort=newest')} className="hover:text-white transition-colors cursor-pointer">New Releases</button>
        <button onClick={() => navigate('/schedule')} className="hover:text-white transition-colors cursor-pointer">Schedule</button>

        {user ? (
          <div className="relative ml-2" ref={profileMenuRef}>
            <button onClick={() => setShowProfileMenu(!showProfileMenu)} className="flex items-center gap-3 bg-[#111] hover:bg-[#1a1a1a] border border-[#222] px-3 py-1.5 rounded-full transition-all shadow-md cursor-pointer">
              <img src={user.user_metadata?.avatar_url || 'https://i.imgur.com/6X2pYyD.png'} alt="Profile" className="w-7 h-7 rounded-full object-cover border border-blue-500/50" />
              <span className="text-[10px] font-black tracking-widest text-white truncate max-w-[80px]">{user.user_metadata?.full_name?.split(' ')[0] || 'User'}</span>
            </button>
            {showProfileMenu && (
              <div className="absolute top-[120%] right-0 bg-[#0a0a0a] border border-[#222] rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] w-[200px] overflow-hidden z-50 flex flex-col">
                <div className="p-4 border-b border-[#222] bg-[#111]/50">
                  <p className="text-xs font-bold text-white truncate">{user.user_metadata?.full_name}</p>
                  <p className="text-[9px] text-gray-500 truncate mt-0.5">{user.email}</p>
                </div>
                <div className="flex flex-col p-2">
                  <button onClick={() => { setShowProfileMenu(false); navigate('/profile'); }} className="flex items-center gap-3 px-3 py-2.5 text-[11px] font-bold text-gray-400 hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors text-left"><LayoutDashboard className="w-4 h-4" /> My Profile</button>
                  <button onClick={() => { setShowProfileMenu(false); navigate('/profile?tab=watchlist'); }} className="flex items-center gap-3 px-3 py-2.5 text-[11px] font-bold text-gray-400 hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors text-left"><Bookmark className="w-4 h-4" /> Watchlist</button>
                </div>
                <div className="p-2 border-t border-[#222]">
                  <button onClick={handleSignOut} className="flex items-center gap-3 w-full px-3 py-2.5 text-[11px] font-bold text-red-500 hover:bg-red-500/10 rounded-lg transition-colors text-left"><LogOut className="w-4 h-4" /> Sign Out</button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button onClick={handleSignIn} className="flex items-center justify-center gap-2 bg-white/10 hover:bg-blue-600 border border-white/10 hover:border-blue-500 text-white px-4 py-2.5 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all shadow-md ml-2 cursor-pointer"><User className="w-4 h-4" /> Sign In</button>
        )}
      </div>
    </nav>
  );
}