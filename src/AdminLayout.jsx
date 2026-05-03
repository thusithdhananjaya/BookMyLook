import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from './firebase';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, writeBatch, updateDoc } from 'firebase/firestore';
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
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);

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

  // Notification listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      const q = query(collection(db, 'notifications'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
      const unsubNotif = onSnapshot(q, (snap) => {
        setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      return () => unsubNotif();
    });
    return () => unsub();
  }, []);

  // Close notification dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifications(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;
    try {
      const batch = writeBatch(db);
      unread.forEach(n => batch.update(doc(db, 'notifications', n.id), { read: true }));
      await batch.commit();
    } catch (err) { console.error('Error marking read:', err); }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/admin-login');
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="bg-background-dark text-white h-screen overflow-hidden flex selection:bg-primary selection:text-white font-display">
      
      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => setMobileMenuOpen(false)}></div>
      )}

      {/* Sidebar — hidden on mobile, slide-in when hamburger clicked */}
      <aside className={`fixed md:static inset-y-0 left-0 w-64 h-full bg-card-dark border-r border-white/5 flex flex-col shrink-0 transition-transform duration-300 z-40 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-6 pb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">BookMyLook</h1>
            <p className="text-text-secondary text-xs mt-1 tracking-widest uppercase">Admin Console</p>
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className="md:hidden text-text-secondary hover:text-white">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = activePage === item.key;
            return (
              <button
                key={item.key}
                onClick={() => { navigate(item.path); setMobileMenuOpen(false); }}
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
        {/* Mobile Header Bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-white/5 bg-card-dark shrink-0">
          <button onClick={() => setMobileMenuOpen(true)} className="text-white p-1">
            <span className="material-symbols-outlined text-2xl">menu</span>
          </button>
          <h1 className="text-lg font-bold">BookMyLook</h1>
          <div className="w-8"></div>
        </div>
        {children}
      </main>
    </div>
  );
};

export default AdminLayout;