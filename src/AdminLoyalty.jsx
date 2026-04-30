import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import AdminLayout from './AdminLayout';
import { LOYALTY_EARN_RATE, LOYALTY_REDEEM_COST, LOYALTY_DISCOUNT_LKR } from './BookingContext';
import { formatLKR } from './utils/formatLKR';

const AdminLoyalty = () => {
  const [activityLogs, setActivityLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Fetch loyalty logs for this salon
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      const q = query(
        collection(db, 'loyaltyLogs'),
        where('salonId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const unsubSnapshot = onSnapshot(q, (snapshot) => {
        setActivityLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }, (err) => {
        console.error('Error fetching loyalty logs:', err);
        setLoading(false);
      });
      return () => unsubSnapshot();
    });
    return () => unsubAuth();
  }, []);

  // Derived metrics
  const totalPointsAwarded = activityLogs.filter(l => l.type === 'earn').reduce((sum, l) => sum + l.points, 0);
  const totalRedemptions = activityLogs.filter(l => l.type === 'redeem').length;
  const uniqueMembers = new Set(activityLogs.map(l => l.customerId)).size;

  return (
    <AdminLayout activePage="loyalty">
      <header className="h-20 px-8 flex items-center justify-between shrink-0 bg-background-dark/80 backdrop-blur-sm z-10 sticky top-0 border-b border-white/5">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Loyalty Program Overview</h2>
          <p className="text-text-secondary text-sm mt-0.5">Track points earned and redeemed by your customers.</p>
        </div>
        <button onClick={() => setIsSettingsModalOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-transparent border border-primary text-primary hover:bg-primary/20 hover:text-primary-glow hover:shadow-glow transition-all duration-300">
          <span className="material-symbols-outlined">settings</span><span className="text-sm font-medium">Program Settings</span>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-8 pt-6 space-y-8 custom-scrollbar">

        {/* Metrics */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-card-dark rounded-2xl p-6 border border-white/5 hover:border-primary/50 hover:shadow-glow transition-all duration-300 group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><span className="material-symbols-outlined text-6xl text-primary">groups</span></div>
            <p className="text-text-secondary font-medium text-sm">Active Members</p>
            <div className="flex items-baseline gap-2 mt-2"><h3 className="text-4xl font-bold text-white">{uniqueMembers}</h3></div>
            <p className="text-text-secondary text-xs mt-1">unique customers with points activity</p>
          </div>

          <div className="bg-card-dark rounded-2xl p-6 border border-white/5 hover:border-primary/50 hover:shadow-glow transition-all duration-300 group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><span className="material-symbols-outlined text-6xl text-primary">monetization_on</span></div>
            <p className="text-text-secondary font-medium text-sm">Total Points Awarded</p>
            <div className="flex items-baseline gap-2 mt-2"><h3 className="text-4xl font-bold text-white">{totalPointsAwarded.toLocaleString()}</h3></div>
            <p className="text-text-secondary text-xs mt-1">across all confirmed bookings</p>
          </div>

          <div className="bg-card-dark rounded-2xl p-6 border border-white/5 hover:border-primary/50 hover:shadow-glow transition-all duration-300 group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><span className="material-symbols-outlined text-6xl text-primary">redeem</span></div>
            <p className="text-text-secondary font-medium text-sm">Total Redemptions</p>
            <div className="flex items-baseline gap-2 mt-2"><h3 className="text-4xl font-bold text-white">{totalRedemptions}</h3></div>
            <p className="text-text-secondary text-xs mt-1">{formatLKR(totalRedemptions * LOYALTY_DISCOUNT_LKR)} in discounts given</p>
          </div>
        </section>

        {/* Program Rules Card */}
        <section className="bg-card-dark rounded-2xl p-6 border border-white/5">
          <h3 className="text-lg font-bold text-white tracking-tight mb-4">Current Program Rules</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div className="flex items-start gap-3">
              <div className="bg-primary/20 p-2 rounded-lg text-primary shrink-0"><span className="material-symbols-outlined">trending_up</span></div>
              <div><p className="font-medium text-white">Earn Rate</p><p className="text-text-secondary mt-1">1 point per {formatLKR(LOYALTY_EARN_RATE)} spent</p></div>
            </div>
            <div className="flex items-start gap-3">
              <div className="bg-[#FFD700]/20 p-2 rounded-lg text-[#FFD700] shrink-0"><span className="material-symbols-outlined">redeem</span></div>
              <div><p className="font-medium text-white">Redemption</p><p className="text-text-secondary mt-1">{LOYALTY_REDEEM_COST} points = {formatLKR(LOYALTY_DISCOUNT_LKR)} discount</p></div>
            </div>
            <div className="flex items-start gap-3">
              <div className="bg-success/20 p-2 rounded-lg text-success shrink-0"><span className="material-symbols-outlined">check_circle</span></div>
              <div><p className="font-medium text-white">When Awarded</p><p className="text-text-secondary mt-1">Points awarded when booking is accepted</p></div>
            </div>
          </div>
        </section>

        {/* Activity Log Table */}
        <section>
          <h3 className="text-lg font-bold text-white tracking-tight mb-4">Recent Point Activity</h3>

          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
              <p className="text-text-secondary text-sm">Loading activity...</p>
            </div>
          )}

          {!loading && activityLogs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <span className="material-symbols-outlined text-6xl text-text-secondary/30">loyalty</span>
              <h3 className="text-xl font-bold text-white">No Activity Yet</h3>
              <p className="text-text-secondary max-w-sm">Points will appear here when you accept customer bookings.</p>
            </div>
          )}

          {!loading && activityLogs.length > 0 && (
            <div className="bg-card-dark border border-white/5 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5 text-text-secondary text-xs uppercase tracking-wider font-semibold border-b border-white/5">
                      <th className="p-4">Date</th>
                      <th className="p-4">Customer</th>
                      <th className="p-4">Action</th>
                      <th className="p-4 text-right">Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {activityLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-4 text-sm text-text-secondary">
                          {log.createdAt?.toDate ? log.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Just now'}
                        </td>
                        <td className="p-4 text-sm font-medium text-white">{log.customerName}</td>
                        <td className="p-4 text-sm text-text-secondary">{log.action}</td>
                        <td className={`p-4 text-sm font-bold text-right ${log.type === 'earn' ? 'text-success' : 'text-danger'}`}>
                          {log.type === 'earn' ? '+' : ''}{log.points}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Settings Modal */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsSettingsModalOpen(false)}></div>
          <div className="relative w-full max-w-lg bg-card-dark border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
              <h3 className="text-white text-lg font-bold">Loyalty Program Settings</h3>
              <button onClick={() => setIsSettingsModalOpen(false)} className="text-text-secondary hover:text-white transition-colors"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="p-6 overflow-y-auto flex flex-col gap-6">
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
                <p className="text-sm text-text-secondary">Current settings are defined in code constants. A future update will allow you to configure these values from this panel and save them to Firestore.</p>
              </div>
              <div>
                <h4 className="text-sm font-bold mb-3 tracking-wide uppercase text-primary-glow">Current Configuration</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-text-secondary">Earn Rate</span><span className="text-white font-medium">1 point per {formatLKR(LOYALTY_EARN_RATE)}</span></div>
                  <div className="flex justify-between"><span className="text-text-secondary">Redemption Cost</span><span className="text-white font-medium">{LOYALTY_REDEEM_COST} points</span></div>
                  <div className="flex justify-between"><span className="text-text-secondary">Discount Value</span><span className="text-white font-medium">{formatLKR(LOYALTY_DISCOUNT_LKR)}</span></div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-white/10 flex justify-end bg-white/5">
              <button onClick={() => setIsSettingsModalOpen(false)} className="px-6 py-2 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary-glow shadow-glow-sm transition-all">Close</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminLoyalty;