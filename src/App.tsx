import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Landing from './pages/Landing';
import Home from './pages/Home';
import AnimeDetails from './pages/AnimeDetails';
import KuroAdmin from './pages/KuroAdmin';
import Search from './pages/Search';
import Schedule from './pages/Schedule';
import Profile from './pages/Profile';
import Contact from './pages/Contact';
import AdminDashboard from './pages/AdminDashboard';

function ScrollRevealObserver() {
  const location = useLocation();
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    
    const observeElements = () => {
      document.querySelectorAll('[data-reveal]:not(.revealed)').forEach(el => observer.observe(el));
    };

    observeElements();
    const timer = setTimeout(observeElements, 100);

    const mutationObserver = new MutationObserver(() => {
      observeElements();
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => { 
      clearTimeout(timer); 
      observer.disconnect(); 
      mutationObserver.disconnect();
    };
  }, [location]);
  return null;
}

export default function App() {
  return (
    <Router>
      <ScrollRevealObserver />
      <div className="min-h-screen text-fg font-body flex flex-col bg-bg">
        <Navbar />
        <main className="flex-1 w-full">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/home" element={<Home />} />
            <Route path="/anime/:id" element={<AnimeDetails />} />
            <Route path="/admin" element={<KuroAdmin />} />
            <Route path="/search" element={<Search />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/admin-dashboard" element={<AdminDashboard />} />
          </Routes>
        </main>
        <footer className="w-full border-t border-border mt-16 md:mt-24 py-8 md:py-10 px-4 md:px-6">
          <div className="max-w-[1500px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3 md:gap-4 text-xs text-muted">
            <Link to="/home" className="text-base md:text-lg font-bold tracking-tight font-display text-fg hover:text-accent transition-colors">
              KURO<span className="text-accent">TV</span>
            </Link>
            <p className="text-[10px] md:text-[11px] text-center md:text-left">This site does not store any files. All content is provided by non-affiliated third parties.</p>
            <div className="flex items-center gap-5 md:gap-6 text-[10px] font-semibold uppercase tracking-widest">
              <Link to="/contact" className="hover:text-fg transition-colors">Request</Link>
              <Link to="/contact" className="hover:text-accent transition-colors">Contact</Link>
            </div>
          </div>
        </footer>
      </div>
    </Router>
  );
}
