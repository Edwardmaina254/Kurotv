import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Search, Loader2, Star, User, LogOut, LayoutDashboard, Bookmark, Filter, Menu, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useDebounce } from '../hooks/useDebounce';

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
  const [liveResults, setLiveResults] = useState<QuickResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileSearchQuery, setMobileSearchQuery] = useState('');
  const [mobileLiveResults, setMobileLiveResults] = useState<QuickResult[]>([]);
  const [isMobileSearching, setIsMobileSearching] = useState(false);
  const [showMobileDropdown, setShowMobileDropdown] = useState(false);
  const debouncedMobileQuery = useDebounce(mobileSearchQuery, 500);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
        options: { redirectTo: window.location.origin }
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
        // 🔥 ADDED: isAdult: false
        const gqlQuery = `
        query ($search: String) {
          Page(page: 1, perPage: 5) {
            media(search: $search, type: ANIME, sort: SEARCH_MATCH, isAdult: false) {
              id title { english romaji } coverImage { extraLarge } type averageScore
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
        if (alData.data?.Page?.media && alData.data.Page.media.length > 0) {
          setLiveResults(alData.data.Page.media.map((anime: any) => ({
            id: anime.id,
            title: { english: anime.title.english || anime.title.romaji, romaji: anime.title.romaji },
            coverImage: { extraLarge: anime.coverImage.extraLarge },
            type: anime.type || 'TV',
            averageScore: anime.averageScore || 0
          })));
        } else {
          setLiveResults([]);
        }
      } catch (error) {
        console.error("Live search failed:", error);
        setLiveResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, location.pathname, location.search]);

  useEffect(() => {
    if (!debouncedMobileQuery.trim() || !mobileSearchOpen) {
      setMobileLiveResults([]);
      setShowMobileDropdown(false);
      return;
    }
    setIsMobileSearching(true);
    setShowMobileDropdown(true);
    const fetchResults = async () => {
      try {
        const gqlQuery = `
        query ($search: String) {
          Page(page: 1, perPage: 5) {
            media(search: $search, type: ANIME, sort: SEARCH_MATCH, isAdult: false) {
              id title { english romaji } coverImage { extraLarge } type averageScore
            }
          }
        }
      `;
        const res = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ query: gqlQuery, variables: { search: debouncedMobileQuery.trim() } })
        });
        const data = await res.json();
        if (data.data?.Page?.media && data.data.Page.media.length > 0) {
          setMobileLiveResults(data.data.Page.media.map((anime: any) => ({
            id: anime.id,
            title: { english: anime.title.english || anime.title.romaji, romaji: anime.title.romaji },
            coverImage: { extraLarge: anime.coverImage.extraLarge },
            type: anime.type || 'TV',
            averageScore: anime.averageScore || 0
          })));
        } else {
          setMobileLiveResults([]);
        }
      } catch {
        setMobileLiveResults([]);
      } finally {
        setIsMobileSearching(false);
      }
    };
    fetchResults();
  }, [debouncedMobileQuery, mobileSearchOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setShowDropdown(false);
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) setShowProfileMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setShowDropdown(false);
    if (searchQuery.trim()) navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  const handleRandom = async () => {
    try {
      const randomPage = Math.floor(Math.random() * 100) + 1;
      const gqlQuery = `query { Page(page: ${randomPage}, perPage: 50) { media(type: ANIME, sort: POPULARITY_DESC) { id } } }`;
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query: gqlQuery })
      });
      const data = await response.json();
      if (data.data?.Page?.media?.length > 0) {
        const mediaArray = data.data.Page.media;
        navigate(`/anime/${mediaArray[Math.floor(Math.random() * mediaArray.length)].id}`);
      }
    } catch (err) { console.error("Failed to fetch random anime", err); }
  };

  const GENRES = ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Mecha", "Music", "Mystery", "Psychological", "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller"];
  const TYPES = [{ label: "Movies", value: "MOVIE" }, { label: "TV Series", value: "TV" }, { label: "OVAs", value: "OVA" }, { label: "ONAs", value: "ONA" }, { label: "Specials", value: "SPECIAL" }];

  if (location.pathname === '/') return null;

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'glass-strong border-b border-border' : 'bg-transparent'}`}>
      <div className="max-w-[1500px] mx-auto flex items-center justify-between px-4 md:px-6 h-14 md:h-16">
        <Link to="/home" onClick={() => { setSearchQuery(''); setMobileMenuOpen(false); }} className="flex items-center gap-1.5 shrink-0">
          <span className="text-lg md:text-xl font-bold tracking-tight font-display text-fg">
            KURO<span className="text-accent">TV</span>
          </span>
        </Link>

        {/* Desktop search — hidden on mobile */}
        <div className="hidden md:block flex-1 max-w-xl mx-6 relative" ref={dropdownRef}>
          <form onSubmit={handleSearch} className={`flex items-center w-full border rounded-xl px-3 h-10 transition-all duration-300 ${scrolled ? 'bg-bg border-border focus-within:border-muted' : 'bg-surface/60 border-border/30 focus-within:border-muted backdrop-blur-sm'}`}>
            <Search className="w-3.5 h-3.5 text-muted shrink-0" />
            <input 
                type="text" 
                placeholder="Search anime..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                onFocus={() => { if (searchQuery.trim() && liveResults.length > 0) setShowDropdown(true); }} 
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchQuery.trim().length > 0) {
                        e.preventDefault();
                        navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                        setShowDropdown(false);
                    }
                }}
                className="bg-transparent border-none outline-none text-xs font-bold text-fg placeholder-muted w-full px-2.5" 
            />
            {isSearching && <Loader2 className="w-3.5 h-3.5 text-accent animate-spin shrink-0" />}
            <button type="button" onClick={() => { setShowDropdown(false); navigate('/search'); }} className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted hover:text-accent transition-colors shrink-0 border-l border-border/50 pl-3 ml-1 cursor-pointer">
              <Filter className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Filter</span>
            </button>
          </form>

          {showDropdown && searchQuery.trim().length > 0 && (
            <div className="absolute top-[calc(100%+6px)] left-0 right-0 bg-surface border border-border rounded-xl overflow-hidden z-40 animate-float-in shadow-lg">
              {isSearching && liveResults.length === 0 ? (
                <div className="p-5 flex justify-center"><Loader2 className="w-5 h-5 text-accent animate-spin" /></div>
              ) : liveResults.length > 0 ? (
                <>
                  {liveResults.map((anime) => (
                    <Link key={anime.id} to={`/anime/${anime.id}?ep=1`} onClick={() => { setShowDropdown(false); setSearchQuery(''); }} className="flex items-center gap-3 px-4 py-2.5 hover:bg-bg transition-colors border-b border-border last:border-0">
                      <img src={anime.coverImage.extraLarge} alt={anime.title.english || anime.title.romaji} className="w-8 h-11 object-cover rounded" />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-sm font-semibold text-fg truncate">{anime.title.english || anime.title.romaji}</span>
                        <div className="flex items-center gap-3 mt-0.5 text-[10px] font-semibold text-muted">
                          <span>{anime.type || "TV"}</span>
                          {anime.averageScore && <span className="flex items-center gap-1"><Star className="w-3 h-3 text-accent fill-accent" />{anime.averageScore}</span>}
                        </div>
                      </div>
                    </Link>
                  ))}
                  <button onClick={handleSearch} className="w-full py-2.5 bg-bg hover:bg-accent-muted text-muted hover:text-fg transition-colors text-xs font-semibold tracking-wider uppercase border-t border-border">View all results</button>
                </>
              ) : (
                <div className="p-5 text-center text-sm text-muted">No instant results found.</div>
              )}
            </div>
          )}
        </div>

        {/* Desktop nav items */}
        <div className="hidden lg:flex items-center gap-5 text-[11px] xl:text-[12px] font-bold tracking-wider text-fg">
          <button onClick={handleRandom} className="hover:text-fg transition-colors cursor-pointer">Random</button>
          <div className="relative group py-4">
            <button className="hover:text-fg transition-colors cursor-pointer">Genres</button>
            <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <div className="bg-surface border border-border rounded-xl p-4 w-[420px] shadow-lg">
                <div className="grid grid-cols-3 gap-2">
                  {GENRES.map((genre) => <button key={genre} onClick={() => navigate(`/search?genre=${genre}`)} className="text-left text-[11px] text-muted hover:text-accent transition-colors px-2 py-1 rounded hover:bg-bg">{genre}</button>)}
                </div>
              </div>
            </div>
          </div>
          <div className="relative group py-4">
            <button className="hover:text-fg transition-colors cursor-pointer">Types</button>
            <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <div className="bg-surface border border-border rounded-xl py-1.5 w-[140px] shadow-lg">
                {TYPES.map((type) => <button key={type.value} onClick={() => navigate(`/search?format=${type.value}`)} className="text-left text-[11px] text-muted hover:text-accent hover:bg-bg transition-colors px-4 py-2 w-full">{type.label}</button>)}
              </div>
            </div>
          </div>
          <button onClick={() => navigate('/search?status=RELEASING&sort=newest')} className="hover:text-fg transition-colors cursor-pointer">New Releases</button>
          <button onClick={() => navigate('/schedule')} className="hover:text-fg transition-colors cursor-pointer">Schedule</button>

          {user ? (
            <div className="relative" ref={profileMenuRef}>
              <button onClick={() => setShowProfileMenu(!showProfileMenu)} className={`flex items-center gap-2 border rounded-xl px-3 h-9 transition-all cursor-pointer ${scrolled ? 'bg-bg border-border hover:border-muted' : 'bg-surface/60 border-border/30 hover:border-muted backdrop-blur-sm'}`}>
                <img src={user.user_metadata?.avatar_url || 'https://i.imgur.com/6X2pYyD.png'} alt="" className="w-5 h-5 rounded-full object-cover" />
                <span className="text-[10px] font-semibold tracking-wider text-fg truncate max-w-[70px]">{user.user_metadata?.full_name?.split(' ')[0] || 'User'}</span>
              </button>
              {showProfileMenu && (
                <div className="absolute top-[calc(100%+6px)] right-0 bg-surface border border-border rounded-xl w-[180px] overflow-hidden z-50 animate-float-in shadow-lg">
                  <div className="p-3 border-b border-border">
                    <p className="text-xs font-semibold text-fg truncate">{user.user_metadata?.full_name}</p>
                    <p className="text-[10px] text-muted truncate mt-0.5">{user.email}</p>
                  </div>
                  <div className="p-1.5">
                    <button onClick={() => { setShowProfileMenu(false); navigate('/profile'); }} className="flex items-center gap-2.5 w-full px-3 py-2 text-[11px] text-muted hover:text-fg hover:bg-bg rounded-md transition-colors text-left"><LayoutDashboard className="w-3.5 h-3.5" /> My Profile</button>
                    <button onClick={() => { setShowProfileMenu(false); navigate('/profile?tab=watchlist'); }} className="flex items-center gap-2.5 w-full px-3 py-2 text-[11px] text-muted hover:text-fg hover:bg-bg rounded-md transition-colors text-left"><Bookmark className="w-3.5 h-3.5" /> Watchlist</button>
                  </div>
                  <div className="p-1.5 border-t border-border">
                    <button onClick={handleSignOut} className="flex items-center gap-2.5 w-full px-3 py-2 text-[11px] text-danger hover:bg-danger/10 rounded-md transition-colors text-left"><LogOut className="w-3.5 h-3.5" /> Sign Out</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button onClick={handleSignIn} className="flex items-center gap-2 bg-accent hover:bg-accent-dim text-white px-4 h-9 rounded-xl text-[10px] font-semibold tracking-wider uppercase transition-all cursor-pointer shadow-sm hover:shadow-md">
              <User className="w-3.5 h-3.5" /> Sign In
            </button>
          )}
        </div>

        {/* Mobile icons — search + hamburger */}
        <div className="flex lg:hidden items-center gap-2">
          <button onClick={() => setMobileSearchOpen(!mobileSearchOpen)} className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all cursor-pointer ${mobileSearchOpen ? 'bg-accent/15 text-accent' : 'text-muted hover:text-fg'}`}>
            {mobileSearchOpen ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
          </button>
          {user ? (
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all cursor-pointer ${mobileMenuOpen ? 'bg-accent/15 text-accent' : 'text-muted hover:text-fg'}`}>
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          ) : (
            <>
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all cursor-pointer ${mobileMenuOpen ? 'bg-accent/15 text-accent' : 'text-muted hover:text-fg'}`}>
                {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mobile search bar — slides down when open */}
      <div className={`md:hidden overflow-hidden transition-all duration-300 ${mobileSearchOpen ? 'max-h-[120px]' : 'max-h-0'}`}>
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2">
            <form onSubmit={(e) => { e.preventDefault(); if (mobileSearchQuery.trim()) { navigate(`/search?q=${encodeURIComponent(mobileSearchQuery.trim())}`); setMobileSearchOpen(false); setMobileSearchQuery(''); setShowMobileDropdown(false); }}} className="flex-1 flex items-center bg-bg border border-border rounded-xl px-3 h-10">
              <Search className="w-3.5 h-3.5 text-muted shrink-0" />
              <input type="text" placeholder="Search anime..." value={mobileSearchQuery} onChange={(e) => setMobileSearchQuery(e.target.value)} onFocus={() => { if (debouncedMobileQuery.trim() && mobileLiveResults.length > 0) setShowMobileDropdown(true); }} autoFocus className="bg-transparent border-none outline-none text-xs font-bold text-fg placeholder-muted w-full px-2.5" />
            </form>
            <button onClick={() => navigate('/search')} className="h-10 px-3 flex items-center justify-center bg-surface border border-border rounded-xl text-muted hover:text-fg transition-colors cursor-pointer">
              <Filter className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile dropdown — rendered outside overflow-hidden so it's not clipped */}
      {showMobileDropdown && debouncedMobileQuery.trim().length > 0 && (
        <div className="md:hidden px-4 pb-2 animate-float-in">
          <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-lg">
            {isMobileSearching && mobileLiveResults.length === 0 ? (
              <div className="p-5 flex justify-center"><Loader2 className="w-5 h-5 text-accent animate-spin" /></div>
            ) : mobileLiveResults.length > 0 ? (
              <>
                {mobileLiveResults.map((anime) => (
                  <Link key={anime.id} to={`/anime/${anime.id}?ep=1`} onClick={() => { setShowMobileDropdown(false); setMobileSearchOpen(false); setMobileSearchQuery(''); }} className="flex items-center gap-3 px-4 py-2.5 hover:bg-bg transition-colors border-b border-border last:border-0">
                    <img src={anime.coverImage.extraLarge} alt={anime.title.english || anime.title.romaji} className="w-8 h-11 object-cover rounded shrink-0" />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm font-semibold text-fg truncate">{anime.title.english || anime.title.romaji}</span>
                      <div className="flex items-center gap-3 mt-0.5 text-[10px] font-semibold text-muted">
                        <span>{anime.type || "TV"}</span>
                        {anime.averageScore && <span className="flex items-center gap-1"><Star className="w-3 h-3 text-accent fill-accent" />{anime.averageScore}</span>}
                      </div>
                    </div>
                  </Link>
                ))}
                <button onClick={(e) => { e.preventDefault(); navigate(`/search?q=${encodeURIComponent(mobileSearchQuery.trim())}`); setShowMobileDropdown(false); setMobileSearchOpen(false); setMobileSearchQuery(''); }} className="w-full py-2.5 bg-bg hover:bg-accent-muted text-muted hover:text-fg transition-colors text-xs font-semibold tracking-wider uppercase border-t border-border">View all results</button>
              </>
            ) : (
              <div className="p-5 text-center text-sm text-muted">No instant results found.</div>
            )}
          </div>
        </div>
      )}

      {/* Mobile slide-out menu */}
      <div className={`fixed inset-0 z-50 transition-opacity duration-300 lg:hidden ${mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
        <div className={`absolute top-0 right-0 w-[280px] h-full bg-bg border-l border-border overflow-y-auto transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex items-center justify-between px-5 h-14 border-b border-border">
            <span className="text-sm font-bold font-display">Menu</span>
            <button onClick={() => setMobileMenuOpen(false)} className="w-8 h-8 flex items-center justify-center text-muted hover:text-fg cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 flex flex-col gap-1">

            {/* User section */}
            {user ? (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-surface border border-border mb-4">
                <img src={user.user_metadata?.avatar_url || 'https://i.imgur.com/6X2pYyD.png'} alt="" className="w-9 h-9 rounded-full object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-fg truncate">{user.user_metadata?.full_name || 'User'}</p>
                  <p className="text-[10px] text-muted truncate">{user.email}</p>
                </div>
              </div>
            ) : (
              <button onClick={() => { handleSignIn(); setMobileMenuOpen(false); }} className="flex items-center gap-3 w-full p-3 rounded-xl bg-accent text-white font-semibold text-xs uppercase tracking-wider mb-4 cursor-pointer">
                <User className="w-4 h-4" /> Sign In
              </button>
            )}

            <button onClick={() => { navigate('/search?status=RELEASING&sort=newest'); setMobileMenuOpen(false); }} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-[12px] font-semibold text-muted hover:text-fg hover:bg-surface transition-all text-left cursor-pointer">
              New Releases
            </button>
            <button onClick={() => { navigate('/schedule'); setMobileMenuOpen(false); }} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-[12px] font-semibold text-muted hover:text-fg hover:bg-surface transition-all text-left cursor-pointer">
              Schedule
            </button>
            <button onClick={handleRandom} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-[12px] font-semibold text-muted hover:text-fg hover:bg-surface transition-all text-left cursor-pointer">
              Random
            </button>

            {/* Genres section */}
            <div className="mt-2 mb-1">
              <span className="kicker block px-4 mb-2">Genres</span>
              <div className="grid grid-cols-2 gap-1 px-2">
                {GENRES.slice(0, 12).map((genre) => (
                  <button key={genre} onClick={() => { navigate(`/search?genre=${genre}`); setMobileMenuOpen(false); }} className="text-left text-[11px] font-semibold text-muted hover:text-accent hover:bg-surface px-3 py-2 rounded-lg transition-all cursor-pointer">
                    {genre}
                  </button>
                ))}
              </div>
            </div>

            {/* Types section */}
            <div className="mt-3 mb-1">
              <span className="kicker block px-4 mb-2">Types</span>
              <div className="grid grid-cols-2 gap-1 px-2">
                {TYPES.map((type) => (
                  <button key={type.value} onClick={() => { navigate(`/search?format=${type.value}`); setMobileMenuOpen(false); }} className="text-left text-[11px] font-semibold text-muted hover:text-accent hover:bg-surface px-3 py-2 rounded-lg transition-all cursor-pointer">
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Profile links for signed-in users */}
            {user && (
              <div className="mt-4 pt-4 border-t border-border flex flex-col gap-1">
                <button onClick={() => { navigate('/profile'); setMobileMenuOpen(false); }} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-[12px] font-semibold text-muted hover:text-fg hover:bg-surface transition-all text-left cursor-pointer">
                  <LayoutDashboard className="w-4 h-4" /> My Profile
                </button>
                <button onClick={() => { navigate('/profile?tab=watchlist'); setMobileMenuOpen(false); }} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-[12px] font-semibold text-muted hover:text-fg hover:bg-surface transition-all text-left cursor-pointer">
                  <Bookmark className="w-4 h-4" /> Watchlist
                </button>
                <button onClick={handleSignOut} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-[12px] font-semibold text-danger hover:bg-danger/10 transition-all text-left cursor-pointer">
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
