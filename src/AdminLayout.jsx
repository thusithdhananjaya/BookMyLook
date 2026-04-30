import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { signOut, onAuthStateChanged } from 'firebase/auth';

// Sidebar navigation items
const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard', path: '/admin-dashboard' },
  { key: 'appointments', label: 'Appointments', icon: 'calendar_month', path: '/admin-appointments' },
  { key: 'services', label: 'Services', icon: 'content_cut', path: '/admin-services' },
  { key: 'lookbook', label: 'Lookbook', icon: 'photo_library', path: '/admin-lookbook' },
  { key: 'reviews', label: 'Reviews', icon: 'rate_review', path: '/admin-reviews' },
  { key: 'staff', label: 'Staff', icon: 'groups', path: '/admin-staff' },
  { key: 'loyalty', label: 'Loyalty', icon: 'loyalty', path: '/admin-loyalty' },
  { key: 'settings', label: 'Settings', icon: 'settings', path: '/admin-settings' },
];

const AdminLayout = ({ activePage, children }) => {
  const navigate = useNavigate();

  const [salonName, setSalonName] = useState('Loading...');
  const [initials, setInitials] = useState('');

  // Fetch salon name for sidebar footer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const fetchedName = docSnap.data().salonName || 'My Salon';
            setSalonName(fetchedName);
            const words = fetchedName.split(' ');
            let generatedInitials = '';
            if (words.length >= 2) {
              generatedInitials = words[0][0] + words[1][0];
            } else if (fetchedName.length >= 2) {
              generatedInitials = fetchedName.substring(0, 2);
            } else {
              generatedInitials = fetchedName[0] || '?';
            }
            setInitials(generatedInitials.toUpperCase());
          }
        } catch (error) {
          console.error("Error fetching salon details:", error);
          setSalonName("My Salon");
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/admin-login');
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  return (
    <div className="bg-background-dark text-white h-screen overflow-hidden flex selection:bg-primary selection:text-white font-display">
      {/* Sidebar */}
      <aside className="w-64 h-full bg-card-dark border-r border-white/5 flex flex-col shrink-0 transition-all duration-300 z-20">
        <div className="p-6 pb-8">
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">BookMyLook</h1>
          <p className="text-text-secondary text-xs mt-1 tracking-widest uppercase">Admin Console</p>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = activePage === item.key;
            return (
              <button
                key={item.key}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive
                    ? 'bg-primary/20 border border-primary/50 shadow-glow text-white'
                    : 'text-text-secondary hover:bg-white/5 hover:text-white'
                }`}
              >
                <span
                  className={`material-symbols-outlined ${
                    isActive ? 'icon-fill text-primary-glow' : 'group-hover:text-primary transition-colors'
                  }`}
                >
                  {item.icon}
                </span>
                <span className="font-medium text-sm">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 mt-auto border-t border-white/5">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-purple-400 flex items-center justify-center text-xs font-bold">
              {initials}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-medium text-white truncate">{salonName}</span>
              <span className="text-xs text-text-secondary">Owner</span>
            </div>
            <button onClick={handleLogout} className="ml-auto text-text-secondary hover:text-danger transition-colors shrink-0">
              <span className="material-symbols-outlined text-[18px]">logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {children}
      </main>
    </div>
  );
};

export default AdminLayout;