import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from './firebase';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import AdminLayout from './AdminLayout';
import { formatLKR } from './utils/formatLKR';

const AdminDashboard = () => {
  const navigate = useNavigate();

  // Dynamic date
  const getFormattedDate = () => {
    const today = new Date();
    const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });
    const month = today.toLocaleDateString('en-US', { month: 'long' });
    const day = today.getDate();
    const year = today.getFullYear();
    const ordinalSuffix = (n) => {
      if (n >= 11 && n <= 13) return 'th';
      switch (n % 10) { case 1: return 'st'; case 2: return 'nd'; case 3: return 'rd'; default: return 'th'; }
    };
    return `${dayOfWeek}, ${month} ${day}${ordinalSuffix(day)}, ${year}`;
  };

  const [salonName, setSalonName] = useState('Loading...');
  const [recentBookings, setRecentBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [reviewCount, setReviewCount] = useState(0);

  // Fetch salon name for greeting
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setSalonName(docSnap.data().salonName || 'My Salon');
          }
        } catch (error) {
          console.error("Error fetching salon details:", error);
          setSalonName("My Salon");
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch recent bookings
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      const q = query(collection(db, 'bookings'), where('salonId', '==', user.uid), orderBy('createdAt', 'desc'));
      const unsubSnapshot = onSnapshot(q, (snapshot) => {
        setRecentBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setBookingsLoading(false);
      }, (err) => {
        console.error('Error fetching dashboard bookings:', err);
        setBookingsLoading(false);
      });
      return () => unsubSnapshot();
    });
    return () => unsubAuth();
  }, []);

  // Fetch reviews count
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      const q = query(collection(db, 'reviews'), where('salonId', '==', user.uid));
      const unsubSnapshot = onSnapshot(q, (snapshot) => {
        setReviewCount(snapshot.docs.length);
      });
      return () => unsubSnapshot();
    });
    return () => unsubAuth();
  }, []);

  const getServiceNames = (services) => (!services || services.length === 0) ? 'No services' : services.map(s => s.name).join(', ');

  return (
    <AdminLayout activePage="dashboard">
      {/* Header */}
      <header className="h-20 px-8 flex items-center justify-between shrink-0 bg-background-dark/80 backdrop-blur-sm z-10 sticky top-0 border-b border-white/5">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Good Morning, {salonName}</h2>
          <p className="text-text-secondary text-sm mt-0.5 flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">calendar_today</span>
            {getFormattedDate()}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button className="w-10 h-10 rounded-full bg-card-dark border border-white/10 flex items-center justify-center text-text-secondary hover:text-white hover:border-primary/50 hover:shadow-glow transition-all">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button className="w-10 h-10 rounded-full bg-card-dark border border-white/10 flex items-center justify-center text-text-secondary hover:text-white hover:border-primary/50 hover:shadow-glow transition-all">
            <span className="material-symbols-outlined">search</span>
          </button>
        </div>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-8 pt-6 space-y-8">
        
        {/* Key Metrics Row */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Total Bookings */}
          <div className="bg-card-dark rounded-2xl p-6 border border-white/5 hover:border-primary/50 hover:shadow-glow transition-all duration-300 group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <span className="material-symbols-outlined text-6xl text-primary">calendar_clock</span>
            </div>
            <p className="text-text-secondary font-medium text-sm">Total Bookings</p>
            <div className="flex items-baseline gap-2 mt-2">
              <h3 className="text-4xl font-bold text-white">{recentBookings.length}</h3>
            </div>
            <p className="text-text-secondary text-xs mt-1">all time</p>
          </div>

          {/* Revenue */}
          <div className="bg-card-dark rounded-2xl p-6 border border-white/5 hover:border-primary/50 hover:shadow-glow transition-all duration-300 group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <span className="material-symbols-outlined text-6xl text-primary">payments</span>
            </div>
            <p className="text-text-secondary font-medium text-sm">Total Revenue</p>
            <div className="flex items-baseline gap-2 mt-2">
              <h3 className="text-4xl font-bold text-white truncate">
                {formatLKR(recentBookings.filter(a => a.status === 'confirmed').reduce((sum, a) => sum + (a.finalCost || 0), 0))}
              </h3>
            </div>
            <p className="text-text-secondary text-xs mt-1">from confirmed bookings</p>
          </div>

          {/* Unique Customers */}
          <div className="bg-card-dark rounded-2xl p-6 border border-white/5 hover:border-primary/50 hover:shadow-glow transition-all duration-300 group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <span className="material-symbols-outlined text-6xl text-primary">person_add</span>
            </div>
            <p className="text-text-secondary font-medium text-sm">Unique Customers</p>
            <div className="flex items-baseline gap-2 mt-2">
              <h3 className="text-4xl font-bold text-white">{new Set(recentBookings.map(b => b.customerId)).size}</h3>
            </div>
            <p className="text-text-secondary text-xs mt-1">total unique</p>
          </div>
        </section>

        {/* Lower Section */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Schedule Table */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white tracking-tight">Recent Bookings</h3>
              <button onClick={() => navigate('/admin-appointments')} className="px-3 py-1.5 rounded-lg bg-card-dark border border-white/10 text-xs text-text-secondary hover:text-white hover:border-primary/50 transition-colors">
                View All
              </button>
            </div>
            
            <div className="bg-card-dark border border-white/5 rounded-2xl overflow-hidden shadow-xl ring-1 ring-white/5">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5 text-text-secondary text-xs uppercase tracking-wider font-semibold border-b border-white/5">
                      <th className="p-4 w-24">Time</th>
                      <th className="p-4">Customer</th>
                      <th className="p-4">Service</th>
                      <th className="p-4">Stylist</th>
                      <th className="p-4 w-32">Status</th>
                      <th className="p-4 w-40">AI Risk <span className="text-primary ml-1" title="AI Prediction">ⓘ</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {bookingsLoading && (
                      <tr><td colSpan="6" className="p-8 text-center text-text-secondary text-sm">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>Loading...
                        </div>
                      </td></tr>
                    )}
                    {!bookingsLoading && recentBookings.length === 0 && (
                      <tr><td colSpan="6" className="p-8 text-center text-text-secondary text-sm">No bookings yet. When customers book your salon, they'll appear here.</td></tr>
                    )}
                    {!bookingsLoading && recentBookings.slice(0, 5).map((appt) => (
                      <tr key={appt.id} onClick={() => navigate('/admin-appointments')}
                        className={`group hover:bg-white/5 transition-colors cursor-pointer ${appt.noShowRisk >= 70 ? 'bg-red-500/5 border-l-2 border-l-danger/50' : ''}`}>
                        <td className="p-4 text-sm font-medium text-white">{appt.time}</td>
                        <td className="p-4">
                          <span className="text-sm font-medium text-white">{appt.customerName}</span>
                          <br/><span className="text-xs text-text-secondary">{appt.customerEmail}</span>
                        </td>
                        <td className="p-4 text-sm text-text-secondary">{getServiceNames(appt.services)}</td>
                        <td className="p-4 text-sm text-text-secondary">{appt.stylist}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            appt.status === 'confirmed' ? 'bg-green-900/30 text-green-400 border border-green-900/50'
                            : appt.status === 'cancelled' ? 'bg-red-900/30 text-red-400 border border-red-900/50'
                            : appt.status === 'no_show' ? 'bg-orange-900/30 text-orange-400 border border-orange-900/50'
                            : 'bg-yellow-900/30 text-yellow-400 border border-yellow-900/50'
                          }`}>{appt.status === 'no_show' ? 'No-Show' : (appt.status ? appt.status.charAt(0).toUpperCase() + appt.status.slice(1) : 'Unknown')}</span>
                        </td>
                        <td className="p-4">
                          {appt.noShowRisk === null || appt.noShowRisk === undefined
                            ? <span className="text-xs text-text-secondary italic">Pending AI</span>
                            : appt.noShowRisk >= 70
                            ? <div className="flex items-center gap-2 bg-danger/10 border border-danger/20 rounded-lg px-2 py-1 w-fit"><span className="material-symbols-outlined text-danger text-[18px] animate-pulse">warning</span><span className="text-xs font-bold text-danger">High Risk</span></div>
                            : appt.noShowRisk >= 40
                            ? <span className="inline-flex items-center gap-1 text-xs text-yellow-500 opacity-80"><span className="material-symbols-outlined text-[14px]">shield_person</span>Medium</span>
                            : <span className="inline-flex items-center gap-1 text-xs text-text-secondary opacity-60"><span className="material-symbols-outlined text-[14px]">shield</span>Low</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Quick Actions Widget */}
          <div className="flex flex-col gap-6">
            <div className="bg-card-dark rounded-2xl p-5 border border-white/5 h-full relative overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Quick Actions</h3>
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(107,70,193,0.8)]"></span>
              </div>
              <div className="space-y-3">
                {/* Reviews — dynamic count */}
                <div onClick={() => navigate('/admin-reviews')} className="bg-white/5 hover:bg-white/10 p-3 rounded-xl border border-white/5 hover:border-primary/30 transition-all cursor-pointer group">
                  <div className="flex items-start gap-3">
                    <div className="bg-primary/20 p-2 rounded-lg text-primary group-hover:text-white group-hover:bg-primary transition-colors">
                      <span className="material-symbols-outlined text-[20px]">rate_review</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{reviewCount} Review{reviewCount !== 1 ? 's' : ''}</p>
                      <p className="text-xs text-text-secondary mt-1">View customer feedback</p>
                    </div>
                    <span className="material-symbols-outlined text-text-secondary text-base group-hover:text-white transition-colors">chevron_right</span>
                  </div>
                </div>

                {/* Pending bookings — dynamic count */}
                <div onClick={() => navigate('/admin-appointments')} className="bg-white/5 hover:bg-white/10 p-3 rounded-xl border border-white/5 hover:border-primary/30 transition-all cursor-pointer group">
                  <div className="flex items-start gap-3">
                    <div className="bg-yellow-500/20 p-2 rounded-lg text-yellow-400 group-hover:text-white group-hover:bg-yellow-500 transition-colors">
                      <span className="material-symbols-outlined text-[20px]">pending_actions</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{recentBookings.filter(b => b.status === 'pending').length} Pending</p>
                      <p className="text-xs text-text-secondary mt-1">Bookings awaiting approval</p>
                    </div>
                    <span className="material-symbols-outlined text-text-secondary text-base group-hover:text-white transition-colors">chevron_right</span>
                  </div>
                </div>

                {/* Lookbook shortcut */}
                <div onClick={() => navigate('/admin-lookbook')} className="bg-white/5 hover:bg-white/10 p-3 rounded-xl border border-white/5 hover:border-primary/30 transition-all cursor-pointer group">
                  <div className="flex items-start gap-3">
                    <div className="bg-primary/20 p-2 rounded-lg text-primary group-hover:text-white group-hover:bg-primary transition-colors">
                      <span className="material-symbols-outlined text-[20px]">photo_library</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">Manage Lookbook</p>
                      <p className="text-xs text-text-secondary mt-1">Upload portfolio photos</p>
                    </div>
                    <span className="material-symbols-outlined text-text-secondary text-base group-hover:text-white transition-colors">chevron_right</span>
                  </div>
                </div>
              </div>
              <div className="mt-auto pt-6">
                <div className="bg-gradient-to-br from-primary/20 to-transparent p-4 rounded-xl border border-primary/20">
                  <p className="text-xs font-bold text-primary-glow mb-1">AI Insight</p>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {(() => {
                      const confirmed = recentBookings.filter(b => b.status === 'confirmed');
                      const noShows = recentBookings.filter(b => b.status === 'no_show');
                      const highRisk = recentBookings.filter(b => b.noShowRisk >= 70);
                      if (highRisk.length > 0) return `${highRisk.length} booking${highRisk.length > 1 ? 's' : ''} flagged as high no-show risk. Consider sending reminders to reduce missed appointments.`;
                      if (noShows.length > 0) return `${noShows.length} no-show${noShows.length > 1 ? 's' : ''} recorded. Customers with repeat no-shows will be flagged by the AI model for future bookings.`;
                      if (confirmed.length >= 5) return `${confirmed.length} confirmed bookings and growing! Your salon is building a strong customer base.`;
                      return 'Keep accepting bookings to unlock AI-powered insights about your appointment patterns.';
                    })()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;