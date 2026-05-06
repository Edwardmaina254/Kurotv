// src/App.tsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Landing from './pages/Landing';
import Home from './pages/Home';
import AnimeDetails from './pages/AnimeDetails';
import KuroAdmin from './pages/KuroAdmin';
import Search from './pages/Search';
import Schedule from './pages/Schedule';
import Profile from './pages/Profile';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-[#040404] text-white font-sans selection:bg-blue-500/30">
        <div className="absolute top-0 left-0 w-full z-50">
          <Navbar />
        </div>

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
        </Routes>

        {/* Global Background Glow */}
        <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-900/5 blur-[150px] rounded-full"></div>
        </div>
      </div>
    </Router>
  );
}