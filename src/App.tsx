// src/App.tsx
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
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


export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-[#040404] text-white font-sans selection:bg-blue-500/30 flex flex-col justify-between relative overflow-hidden">

        {/* Global Navigation Bar */}
        <div className="absolute top-0 left-0 w-full z-50">
          <Navbar />
        </div>

        {/* Main Application Routes */}
        <div className="flex-1 w-full z-10">
          <Routes>
            {/* The new Landing Splash Page */}
            <Route path="/" element={<Landing />} />

            {/* The main Netflix-style Dashboard */}
            <Route path="/home" element={<Home />} />

            <Route path="/anime/:id" element={<AnimeDetails />} />
            <Route path="/admin" element={<KuroAdmin />} />
            <Route path="/search" element={<Search />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/profile" element={<Profile />} />

            {/* ⚡ THE FEEDBACK ROUTE: Dedicated Contact Page */}
            <Route path="/contact" element={<Contact />} />
            {/* Insert inside your <Routes> block: */}
            <Route path="/admin" element={<AdminDashboard />} />
          </Routes>
        </div>

        {/* ⚡ GLOBAL FOOTER: Matches Anime Kai placement perfectly */}
        <footer className="w-full bg-[#040404] border-t border-[#111] py-8 px-4 sm:px-8 mt-auto relative z-40">
          <div className="max-w-[1500px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-600">
            <div>
              <p className="font-bold text-gray-500 mb-1">Copyright ©KuroTV. All Rights Reserved</p>
              <p className="text-[10px]">This site does not store any files on its server. All contents are provided by non-affiliated third parties.</p>
            </div>

            <div className="flex items-center gap-6 font-black uppercase tracking-widest text-[10px]">
              <Link to="/contact" className="hover:text-white transition-colors cursor-pointer">Request</Link>
              <Link to="/contact" className="hover:text-[#f15a24] transition-colors cursor-pointer text-gray-400">Contact Us</Link>
            </div>
          </div>
        </footer>

        {/* Global Background Glow */}
        <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-900/5 blur-[150px] rounded-full"></div>
        </div>

      </div>
    </Router>
  );
}