import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from './firebase';
import { signOut } from 'firebase/auth';
import { useAuth } from './AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';

// Sidebar navigation items — no search tab
const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'grid_view', path: '/home' },
  { key: 'my-appointments', label: 'My Appointments', icon: 'calendar_month', path: '/my-appointments' },
  { key: 'saved-salons', label: 'Saved Salons', icon: 'favorite', path: '/saved-salons' },
  { key: 'booking-history', label: 'Booking History', icon: 'history', path: '/booking-history' },
  { key: 'profile', label: 'Profile', icon: 'person', path: '/profile' },
];

const CustomerLayout = ({ activePage, children }) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [allSalons, setAllSalons] = useState([]);
  const [salonsLoaded, setSalonsLoaded] = useState(false);
  const searchRef = useRef(null);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  // Fetch all salons once for search suggestions
  useEffect(() => {
    const fetchSalons = async () => {
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'admin'), where('status', '==', 'approved'));
        const snap = await getDocs(q);
        const salons = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Also fetch services to get category data per salon
        const servicesSnap = await getDocs(query(collection(db, 'services'), where('isActive', '==', true)));
        const servicesBySalon = {};
        servicesSnap.docs.forEach(d => {
          const data = d.data();
          if (!servicesBySalon[data.salonId]) servicesBySalon[data.salonId] = new Set();
          servicesBySalon[data.salonId].add(data.category);
        });

        const enriched = salons.map(s => ({
          ...s,
          serviceCategories: servicesBySalon[s.id] ? Array.from(servicesBySalon[s.id]) : [],
        }));

        setAllSalons(enriched);
        setSalonsLoaded(true);
      } catch (err) {
        console.error('Error fetching salons for search:', err);
      }
    };
    fetchSalons();
  }, []);

  // Filter suggestions as user types
  useEffect(() => {
    if (!searchQuery.trim() || !salonsLoaded) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    const matches = allSalons.filter(s =>
      (s.salonName || '').toLowerCase().includes(q) ||
      (s.salonAddress || '').toLowerCase().includes(q) ||
      (s.aboutSalon || '').toLowerCase().includes(q) ||
      s.serviceCategories.some(cat => cat.toLowerCase().includes(q))
    ).slice(0, 6); // Max 6 suggestions
    setSearchResults(matches);
  }, [searchQuery, allSalons, salonsLoaded]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle Enter key — navigate to results page
  const handleSearchSubmit = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      setShowDropdown(false);
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  // Handle clicking a suggestion
  const handleSuggestionClick = (salon) => {
    setShowDropdown(false);
    setSearchQuery('');
    navigate(`/salon/${salon.id}`);
  };

  // Handle "See all results" click
  const handleSeeAll = () => {
    setShowDropdown(false);
    navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <div className="font-display bg-dark-bg text-text-primary min-h-screen flex flex-col overflow-x-hidden bg-dashboard-gradient">
      
      {/* --- HEADER --- */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border-color bg-surface/80 px-4 py-3 backdrop-blur-xl md:px-8">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="BookMyLook Logo" className="h-8 w-auto" />
          <h2 className="text-lg font-bold leading-tight tracking-[-0.015em]">BookMyLook</h2>
          
          {/* Search Bar with Dropdown */}
          <div ref={searchRef} className="hidden md:block relative ml-8">
            <div className={`flex items-center bg-white/5 border rounded-xl px-3 py-1.5 w-72 transition-all ${showDropdown && searchQuery ? 'border-brand-purple ring-1 ring-brand-purple' : 'border-border-color focus-within:border-brand-purple'}`}>
              <span className="material-symbols-outlined text-brand-purple text-[20px]">search</span>
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true); }}
                onFocus={() => { if (searchQuery.trim()) setShowDropdown(true); }}
                onKeyDown={handleSearchSubmit}
                placeholder="Search salons, services..." 
                className="bg-transparent border-none text-sm text-text-primary placeholder-text-secondary focus:ring-0 w-full ml-2 focus:outline-none"
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setShowDropdown(false); }} className="text-text-secondary hover:text-white transition-colors">
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              )}
            </div>

            {/* Dropdown Suggestions */}
            {showDropdown && searchQuery.trim() && (
              <div className="absolute top-full left-0 mt-2 w-96 bg-[#1A1B26] border border-border-color rounded-2xl shadow-2xl overflow-hidden z-50 animate-[fadeIn_0.15s_ease-out]">
                {searchResults.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <span className="material-symbols-outlined text-3xl text-text-secondary/30 mb-2">search_off</span>
                    <p className="text-sm text-text-secondary">No salons match "{searchQuery}"</p>
                  </div>
                ) : (
                  <>
                    <div className="px-4 py-2 border-b border-white/5">
                      <p className="text-xs text-text-secondary font-medium uppercase tracking-wider">Salons</p>
                    </div>
                    {searchResults.map((salon) => (
                      <button
                        key={salon.id}
                        onClick={() => handleSuggestionClick(salon)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-brand-purple/10 transition-colors text-left"
                      >
                        <div className="w-10 h-10 rounded-lg bg-white/10 overflow-hidden shrink-0">
                          {salon.logoUrl ? (
                            <img src={salon.logoUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="material-symbols-outlined text-text-secondary text-lg">store</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{salon.salonName}</p>
                          <p className="text-xs text-text-secondary truncate">
                            {salon.serviceCategories.length > 0
                              ? salon.serviceCategories.join(' · ')
                              : (salon.salonAddress || 'Beauty salon')}
                          </p>
                        </div>
                        <span className="material-symbols-outlined text-text-secondary text-base shrink-0">chevron_right</span>
                      </button>
                    ))}
                    <button
                      onClick={handleSeeAll}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 border-t border-white/5 text-sm font-medium text-brand-purple hover:bg-brand-purple/10 transition-colors"
                    >
                      <span className="material-symbols-outlined text-base">search</span>
                      See all results for "{searchQuery}"
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Categories */}
          <div className="flex space-x-4 overflow-x-auto pb-1 scrollbar-hide items-end mt-5 px-1">
            {/* Hair */}
            <div className="flex flex-col items-center space-y-1 min-w-[50px] cursor-pointer group">
              <div className="w-11 h-11 p-2.5 rounded-xl bg-[#252836] border border-gray-700 group-hover:border-purple-500 group-hover:border-opacity-100 flex items-center justify-center shadow-sm transition-all duration-200 ease-in-out">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z"></path>
                </svg>
              </div>
              <span className="text-[10px] font-medium text-gray-400 group-hover:text-purple-400 transition-colors">Hair</span>
            </div>
            {/* Facial */}
            <div className="flex flex-col items-center space-y-1 min-w-[50px] cursor-pointer group">
              <div className="w-11 h-11 p-2.5 rounded-xl bg-[#252836] border border-gray-700 group-hover:border-blue-500 group-hover:border-opacity-100 flex items-center justify-center shadow-sm transition-all duration-200 ease-in-out">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <span className="text-[10px] font-medium text-gray-400 group-hover:text-blue-400 transition-colors">Facial</span>
            </div>
            {/* Nails */}
            <div className="flex flex-col items-center space-y-1 min-w-[50px] cursor-pointer group">
              <div className="w-11 h-11 p-2.5 rounded-xl bg-[#252836] border border-gray-700 group-hover:border-pink-500 group-hover:border-opacity-100 flex items-center justify-center shadow-sm transition-all duration-200 ease-in-out">
                <svg className="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11"></path>
                </svg>
              </div>
              <span className="text-[10px] font-medium text-gray-400 group-hover:text-pink-400 transition-colors">Nails</span>
            </div>
            {/* Massage */}
            <div className="flex flex-col items-center space-y-1 min-w-[50px] cursor-pointer group">
              <div className="w-11 h-11 p-2.5 rounded-xl bg-[#252836] border border-gray-700 group-hover:border-green-500 group-hover:border-opacity-100 flex items-center justify-center shadow-sm transition-all duration-200 ease-in-out">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
                </svg>
              </div>
              <span className="text-[10px] font-medium text-gray-400 group-hover:text-green-400 transition-colors">Massage</span>
            </div>
            {/* Makeup */}
            <div className="flex flex-col items-center space-y-1 min-w-[50px] cursor-pointer group">
              <div className="w-11 h-11 p-2.5 rounded-xl bg-[#252836] border border-gray-700 group-hover:border-orange-500 group-hover:border-opacity-100 flex items-center justify-center shadow-sm transition-all duration-200 ease-in-out">
                <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.5 10.5L12 5.5l-3.5 5h7zM12 5.5V3a1 1 0 00-2 0v2.5M8.5 10.5v8a1 1 0 001 1h5a1 1 0 001-1v-8h-7z" />
                </svg>
              </div>
              <span className="text-[10px] font-medium text-gray-400 group-hover:text-orange-400 transition-colors">Makeup</span>
            </div>
          </div>
        </div>

        {/* Top Right Profile Section */}
        <div className="flex items-center space-x-5">
          <button className="relative p-2 text-gray-400 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
            </svg>
            <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border border-[#1f1d2b]"></span>
          </button>

          <div className="relative">
            <button 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-transparent hover:border-brand-purple focus:outline-none transition-all"
            >
              <img 
                src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=80" 
                alt="Profile" 
                className="w-full h-full rounded-full object-cover"
              />
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 mt-3 w-48 bg-[#252836] rounded-xl shadow-xl border border-gray-700 py-2 z-50 animate-[fadeIn_0.2s_ease-out]">
                <div className="px-4 py-3 border-b border-gray-700 mb-1">
                  <p className="text-sm text-white font-bold">{currentUser?.displayName || 'User'}</p>
                  <p className="text-xs text-gray-400">{currentUser?.email || ''}</p>
                </div>
                <button onClick={() => { setIsProfileOpen(false); navigate('/profile'); }} className="w-full text-left block px-4 py-2 text-sm text-gray-300 hover:bg-brand-purple hover:text-white transition-colors">
                  My Profile
                </button>
                <button className="w-full text-left block px-4 py-2 text-sm text-gray-300 hover:bg-brand-purple hover:text-white transition-colors">
                  Settings
                </button>
                <button onClick={handleLogout} className="w-full text-left block px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors">
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* --- SIDEBAR --- */}
        <aside className="hidden w-64 flex-col border-r border-border-color bg-surface/30 p-4 md:flex overflow-y-auto">
          <nav className="flex flex-col gap-2">
            {NAV_ITEMS.map((item) => {
              const isActive = activePage === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => navigate(item.path)}
                  className={`flex w-full justify-start items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-left transition-colors ${
                    isActive
                      ? 'bg-brand-purple/20 font-semibold text-text-primary'
                      : 'text-text-secondary hover:bg-white/10 hover:text-text-primary'
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-xl ${isActive ? 'text-[#8b5cf6]' : ''}`}
                    style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
                  >
                    {item.icon}
                  </span>
                  <span className={isActive ? 'text-[#8b5cf6]' : ''}>{item.label}</span>
                </button>
              );
            })}
          </nav>
          
          <div className="mt-auto pt-4">
            <button 
              onClick={handleLogout}
              className="flex w-full justify-start items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-text-secondary text-left transition-colors hover:bg-red-500/10 hover:text-red-400"
            >
              <span className="material-symbols-outlined text-xl">logout</span>
              <span>Log Out</span>
            </button>
          </div>
        </aside>

        {/* --- MAIN CONTENT --- */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
};

export default CustomerLayout;