import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from './firebase';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, writeBatch } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import AdminLayout from './AdminLayout';
import { formatLKR } from './utils/formatLKR';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const AdminDashboard = () => {
  const navigate = useNavigate();

  // Notification state
  const [adminNotifs, setAdminNotifs] = useState([]);
  const [showAdminNotifs, setShowAdminNotifs] = useState(false);
  const notifRef = useRef(null);

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) setSalonName(docSnap.data().salonName || 'My Salon');
        } catch (error) { console.error("Error fetching salon details:", error); setSalonName("My Salon"); }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      const q = query(collection(db, 'bookings'), where('salonId', '==', user.uid), orderBy('createdAt', 'desc'));
      const unsubSnapshot = onSnapshot(q, (snapshot) => {
        setRecentBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setBookingsLoading(false);
      }, (err) => { console.error('Error fetching dashboard bookings:', err); setBookingsLoading(false); });
      return () => unsubSnapshot();
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      const q = query(collection(db, 'reviews'), where('salonId', '==', user.uid));
      const unsubSnapshot = onSnapshot(q, (snapshot) => { setReviewCount(snapshot.docs.length); });
      return () => unsubSnapshot();
    });
    return () => unsubAuth();
  }, []);

  // Notification listener
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      const q = query(collection(db, 'notifications'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
      const unsubNotif = onSnapshot(q, (snap) => {
        setAdminNotifs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
      return () => unsubNotif();
    });
    return () => unsubAuth();
  }, []);

  // Close notification dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowAdminNotifs(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const adminUnreadCount = adminNotifs.filter(n => !n.read).length;

  const markAdminNotifsRead = async () => {
    const unread = adminNotifs.filter(n => !n.read);
    if (unread.length === 0) return;
    try {
      const batch = writeBatch(db);
      unread.forEach(n => batch.update(doc(db, 'notifications', n.id), { read: true }));
      await batch.commit();
    } catch (err) { console.error('Error marking read:', err); }
  };

  const getServiceNames = (services) => (!services || services.length === 0) ? 'No services' : services.map(s => s.name).join(', ');

  // Chart data helpers
  const revenueData = (() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
      const revenue = recentBookings.filter(b => {
        if (!b.createdAt?.toDate) return false;
        return b.createdAt.toDate().toDateString() === d.toDateString() && b.status === 'confirmed';
      }).reduce((sum, b) => sum + (b.finalCost || 0), 0);
      days.push({ day: dayLabel, revenue });
    }
    return days;
  })();

  const bookingsByDay = (() => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return dayNames.map((name, idx) => ({
      day: name,
      count: recentBookings.filter(b => b.createdAt?.toDate && b.createdAt.toDate().getDay() === idx).length
    }));
  })();

  const serviceData = (() => {
    const counts = {};
    recentBookings.forEach(b => (b.services || []).forEach(s => { counts[s.name] = (counts[s.name] || 0) + 1; }));
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  })();
  const COLORS = ['#6B46C1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#7c3aed'];

  return (
    <AdminLayout activePage="dashboard">
      <header className="h-20 px-8 flex items-center justify-between shrink-0 bg-background-dark/80 backdrop-blur-sm z-10 sticky top-0 border-b border-white/5">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Good Morning, {salonName}</h2>
          <p className="text-text-secondary text-sm mt-0.5 flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">calendar_today</span>{getFormattedDate()}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div ref={notifRef} className="relative">
            <button onClick={() => { setShowAdminNotifs(!showAdminNotifs); if (!showAdminNotifs) markAdminNotifsRead(); }}
              className="w-10 h-10 rounded-full bg-card-dark border border-white/10 flex items-center justify-center text-text-secondary hover:text-white hover:border-primary/50 hover:shadow-glow transition-all relative">
              <span className="material-symbols-outlined">notifications</span>
              {adminUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 rounded-full text-[10px] font-bold text-white px-1">{adminUnreadCount > 9 ? '9+' : adminUnreadCount}</span>
              )}
            </button>
            {showAdminNotifs && (
              <div className="absolute right-0 mt-2 w-80 bg-[#1A1B26] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden animate-[fadeIn_0.15s_ease-out]">
                <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white">Notifications</h4>
                  {adminUnreadCount > 0 && <span className="text-xs text-primary font-medium">{adminUnreadCount} new</span>}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {adminNotifs.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <span className="material-symbols-outlined text-3xl text-text-secondary/30">notifications_none</span>
                      <p className="text-sm text-text-secondary mt-2">No notifications yet</p>
                    </div>
                  ) : (
                    adminNotifs.slice(0, 10).map(notif => (
                      <div key={notif.id} className={`px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors ${!notif.read ? 'bg-primary/5' : ''}`}>
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${notif.type === 'review' ? 'bg-primary/20 text-primary' : 'bg-white/10 text-text-secondary'}`}>
                            <span className="material-symbols-outlined text-base">{notif.type === 'review' ? 'star' : 'notifications'}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white">{notif.title}</p>
                            <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{notif.message}</p>
                            <p className="text-[10px] text-text-secondary/60 mt-1">{notif.createdAt?.toDate ? notif.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Just now'}</p>
                          </div>
                          {!notif.read && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5"></div>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <button className="w-10 h-10 rounded-full bg-card-dark border border-white/10 flex items-center justify-center text-text-secondary hover:text-white hover:border-primary/50 hover:shadow-glow transition-all"><span className="material-symbols-outlined">search</span></button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 pt-6 space-y-8">
        
        {/* KPI Cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-card-dark rounded-2xl p-6 border border-white/5 hover:border-primary/50 hover:shadow-glow transition-all duration-300 group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><span className="material-symbols-outlined text-6xl text-primary">calendar_clock</span></div>
            <p className="text-text-secondary font-medium text-sm">Total Bookings</p>
            <h3 className="text-4xl font-bold text-white mt-2">{recentBookings.length}</h3>
            <p className="text-text-secondary text-xs mt-1">all time</p>
          </div>
          <div className="bg-card-dark rounded-2xl p-6 border border-white/5 hover:border-primary/50 hover:shadow-glow transition-all duration-300 group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><span className="material-symbols-outlined text-6xl text-primary">payments</span></div>
            <p className="text-text-secondary font-medium text-sm">Total Revenue</p>
            <h3 className="text-4xl font-bold text-white mt-2 truncate">{formatLKR(recentBookings.filter(a => a.status === 'confirmed').reduce((sum, a) => sum + (a.finalCost || 0), 0))}</h3>
            <p className="text-text-secondary text-xs mt-1">from confirmed bookings</p>
          </div>
          <div className="bg-card-dark rounded-2xl p-6 border border-white/5 hover:border-primary/50 hover:shadow-glow transition-all duration-300 group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><span className="material-symbols-outlined text-6xl text-primary">person_add</span></div>
            <p className="text-text-secondary font-medium text-sm">Unique Customers</p>
            <h3 className="text-4xl font-bold text-white mt-2">{new Set(recentBookings.map(b => b.customerId)).size}</h3>
            <p className="text-text-secondary text-xs mt-1">total unique</p>
          </div>
        </section>

        {/* Analytics Charts — 3 equal columns matching KPI cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Revenue Trend */}
          <div className="bg-card-dark rounded-2xl p-5 border border-white/5">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Revenue Trend (Last 7 Days)</h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2D3748" />
                  <XAxis dataKey="day" tick={{ fill: '#A0AEC0', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#A0AEC0', fontSize: 11 }} axisLine={false} tickLine={false} width={45} />
                  <Tooltip contentStyle={{ backgroundColor: '#1A1B26', border: '1px solid #2D3748', borderRadius: '12px', fontSize: '12px' }} labelStyle={{ color: '#A0AEC0' }} formatter={(value) => [formatLKR(value), 'Revenue']} />
                  <Line type="monotone" dataKey="revenue" stroke="#6B46C1" strokeWidth={2.5} dot={{ fill: '#6B46C1', r: 4 }} activeDot={{ r: 6, stroke: '#6B46C1', strokeWidth: 2, fill: '#fff' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bookings by Day */}
          <div className="bg-card-dark rounded-2xl p-5 border border-white/5">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Bookings by Day</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bookingsByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2D3748" />
                  <XAxis dataKey="day" tick={{ fill: '#A0AEC0', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#A0AEC0', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={25} />
                  <Tooltip content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div style={{ backgroundColor: '#1A1B26', border: '1px solid #2D3748', borderRadius: '12px', padding: '8px 12px', fontSize: '12px' }}>
                        <p style={{ color: '#A0AEC0', marginBottom: '4px' }}>{label}</p>
                        <p style={{ color: '#fff', fontWeight: 'bold' }}>{payload[0].value} booking{payload[0].value !== 1 ? 's' : ''}</p>
                      </div>
                    );
                  }} cursor={{ fill: 'rgba(107, 70, 193, 0.1)' }} />
                  <Bar dataKey="count" fill="#6B46C1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Popular Services */}
          <div className="bg-card-dark rounded-2xl p-5 border border-white/5">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Popular Services</h3>
            <div className="h-48 flex items-center justify-center">
              {serviceData.length === 0 ? (
                <p className="text-text-secondary text-sm">No data yet</p>
              ) : (
                <div className="flex items-center gap-3 w-full">
                  <div className="w-[120px] h-[120px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={serviceData} cx="50%" cy="50%" innerRadius={30} outerRadius={55} paddingAngle={3} dataKey="value" stroke="none">
                          {serviceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#1A1B26', border: '1px solid #2D3748', borderRadius: '12px', fontSize: '12px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    {serviceData.map((item, i) => (
                      <div key={item.name} className="flex items-center gap-2 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                        <span className="text-text-secondary truncate flex-1">{item.name}</span>
                        <span className="text-white font-bold">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Recent Bookings + Quick Actions */}
        <section className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white tracking-tight">Recent Bookings</h3>
              <button onClick={() => navigate('/admin-appointments')} className="px-3 py-1.5 rounded-lg bg-card-dark border border-white/10 text-xs text-text-secondary hover:text-white hover:border-primary/50 transition-colors">View All</button>
            </div>
            <div className="bg-card-dark border border-white/5 rounded-2xl overflow-hidden shadow-xl ring-1 ring-white/5">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5 text-text-secondary text-xs uppercase tracking-wider font-semibold border-b border-white/5">
                      <th className="p-4 w-24">Time</th><th className="p-4">Customer</th><th className="p-4">Service</th><th className="p-4">Stylist</th><th className="p-4 w-32">Status</th><th className="p-4 w-40">AI Risk <span className="text-primary ml-1">ⓘ</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {bookingsLoading && (<tr><td colSpan="6" className="p-8 text-center text-text-secondary text-sm"><div className="flex items-center justify-center gap-2"><div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>Loading...</div></td></tr>)}
                  {!bookingsLoading && recentBookings.length === 0 && (<tr><td colSpan="6" className="p-8 text-center text-text-secondary text-sm">No bookings yet.</td></tr>)}
                  {!bookingsLoading && recentBookings.slice(0, 5).map((appt) => (
                    <tr key={appt.id} onClick={() => navigate('/admin-appointments')} className={`group hover:bg-white/5 transition-colors cursor-pointer ${appt.noShowRisk >= 70 ? 'bg-red-500/5 border-l-2 border-l-danger/50' : ''}`}>
                      <td className="p-4 text-sm font-medium text-white">{appt.time}</td>
                      <td className="p-4"><span className="text-sm font-medium text-white">{appt.customerName}</span><br/><span className="text-xs text-text-secondary">{appt.customerEmail}</span></td>
                      <td className="p-4 text-sm text-text-secondary">{getServiceNames(appt.services)}</td>
                      <td className="p-4 text-sm text-text-secondary">{appt.stylist}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${appt.status === 'confirmed' ? 'bg-green-900/30 text-green-400 border border-green-900/50' : appt.status === 'cancelled' ? 'bg-red-900/30 text-red-400 border border-red-900/50' : appt.status === 'no_show' ? 'bg-orange-900/30 text-orange-400 border border-orange-900/50' : 'bg-yellow-900/30 text-yellow-400 border border-yellow-900/50'}`}>
                          {appt.status === 'no_show' ? 'No-Show' : (appt.status ? appt.status.charAt(0).toUpperCase() + appt.status.slice(1) : 'Unknown')}
                        </span>
                      </td>
                      <td className="p-4">
                        {appt.noShowRisk === null || appt.noShowRisk === undefined ? <span className="text-xs text-text-secondary italic">Pending AI</span>
                          : appt.noShowRisk >= 70 ? <div className="flex items-center gap-2 bg-danger/10 border border-danger/20 rounded-lg px-2 py-1 w-fit"><span className="material-symbols-outlined text-danger text-[18px] animate-pulse">warning</span><span className="text-xs font-bold text-danger">High Risk</span></div>
                          : appt.noShowRisk >= 40 ? <span className="inline-flex items-center gap-1 text-xs text-yellow-500 opacity-80"><span className="material-symbols-outlined text-[14px]">shield_person</span>Medium</span>
                          : <span className="inline-flex items-center gap-1 text-xs text-text-secondary opacity-60"><span className="material-symbols-outlined text-[14px]">shield</span>Low</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-card-dark rounded-2xl p-5 border border-white/5 flex flex-col h-fit lg:sticky lg:top-28">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Quick Actions</h3>
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(107,70,193,0.8)]"></span>
            </div>
            <div className="space-y-3">
              <div onClick={() => navigate('/admin-reviews')} className="bg-white/5 hover:bg-white/10 p-3 rounded-xl border border-white/5 hover:border-primary/30 transition-all cursor-pointer group">
                <div className="flex items-start gap-3">
                  <div className="bg-primary/20 p-2 rounded-lg text-primary group-hover:text-white group-hover:bg-primary transition-colors"><span className="material-symbols-outlined text-[20px]">rate_review</span></div>
                  <div className="flex-1"><p className="text-sm font-medium text-white">{reviewCount} Review{reviewCount !== 1 ? 's' : ''}</p><p className="text-xs text-text-secondary mt-1">View customer feedback</p></div>
                  <span className="material-symbols-outlined text-text-secondary text-base group-hover:text-white transition-colors">chevron_right</span>
                </div>
              </div>
              <div onClick={() => navigate('/admin-appointments')} className="bg-white/5 hover:bg-white/10 p-3 rounded-xl border border-white/5 hover:border-primary/30 transition-all cursor-pointer group">
                <div className="flex items-start gap-3">
                  <div className="bg-yellow-500/20 p-2 rounded-lg text-yellow-400 group-hover:text-white group-hover:bg-yellow-500 transition-colors"><span className="material-symbols-outlined text-[20px]">pending_actions</span></div>
                  <div className="flex-1"><p className="text-sm font-medium text-white">{recentBookings.filter(b => b.status === 'pending').length} Pending</p><p className="text-xs text-text-secondary mt-1">Bookings awaiting approval</p></div>
                  <span className="material-symbols-outlined text-text-secondary text-base group-hover:text-white transition-colors">chevron_right</span>
                </div>
              </div>
              <div onClick={() => navigate('/admin-lookbook')} className="bg-white/5 hover:bg-white/10 p-3 rounded-xl border border-white/5 hover:border-primary/30 transition-all cursor-pointer group">
                <div className="flex items-start gap-3">
                  <div className="bg-primary/20 p-2 rounded-lg text-primary group-hover:text-white group-hover:bg-primary transition-colors"><span className="material-symbols-outlined text-[20px]">photo_library</span></div>
                  <div className="flex-1"><p className="text-sm font-medium text-white">Manage Lookbook</p><p className="text-xs text-text-secondary mt-1">Upload portfolio photos</p></div>
                  <span className="material-symbols-outlined text-text-secondary text-base group-hover:text-white transition-colors">chevron_right</span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-white/5">
              <div className="bg-gradient-to-br from-primary/20 to-transparent p-4 rounded-xl border border-primary/20">
                <p className="text-xs font-bold text-primary-glow mb-1">AI Insight</p>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {(() => {
                    const confirmed = recentBookings.filter(b => b.status === 'confirmed');
                    const noShows = recentBookings.filter(b => b.status === 'no_show');
                    const highRisk = recentBookings.filter(b => b.noShowRisk >= 70);
                    if (highRisk.length > 0) return `${highRisk.length} booking${highRisk.length > 1 ? 's' : ''} flagged as high no-show risk. Consider sending reminders.`;
                    if (noShows.length > 0) return `${noShows.length} no-show${noShows.length > 1 ? 's' : ''} recorded. Repeat offenders will be flagged by AI.`;
                    if (confirmed.length >= 5) return `${confirmed.length} confirmed bookings! Your salon is building a strong customer base.`;
                    return 'Keep accepting bookings to unlock AI-powered insights.';
                  })()}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;