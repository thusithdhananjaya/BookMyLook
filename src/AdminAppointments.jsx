import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, getDoc, increment, serverTimestamp } from 'firebase/firestore';
import AdminLayout from './AdminLayout';
import { formatLKR } from './utils/formatLKR';
import { LOYALTY_EARN_RATE, LOYALTY_REDEEM_COST } from './BookingContext';

const AdminAppointments = () => {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      const q = query(collection(db, 'bookings'), where('salonId', '==', user.uid), orderBy('createdAt', 'desc'));
      const unsubSnapshot = onSnapshot(q, (snapshot) => {
        setAppointments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      }, (err) => {
        console.error('Error fetching appointments:', err);
        setError('Failed to load appointments. Check browser console for Firestore index link.');
        setLoading(false);
      });
      return () => unsubSnapshot();
    });
    return () => unsubAuth();
  }, []);

  const filteredAppointments = filterStatus === 'all' ? appointments : appointments.filter(a => a.status === filterStatus);

  const getFormattedDate = (appt) => (!appt.month || !appt.date || !appt.year) ? 'Not set' : `${appt.month.slice(0, 3)} ${appt.date}, ${appt.year}`;
  const getServiceNames = (services) => (!services || services.length === 0) ? 'No services' : services.map(s => s.name).join(', ');

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      confirmed: 'bg-success/10 text-success border-success/20',
      cancelled: 'bg-danger/10 text-danger border-danger/20',
      completed: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      no_show: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    };
    const style = styles[status] || 'bg-white/5 text-text-secondary border-white/10';
    return <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${style}`}>{status === 'no_show' ? 'No-Show' : (status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown')}</span>;
  };

  const getRiskBadge = (risk) => {
    if (risk === null || risk === undefined) return <span className="text-xs text-text-secondary italic">Pending AI</span>;
    if (risk >= 70) return <span className="flex items-center gap-1 text-xs font-bold text-danger"><span className="material-symbols-outlined text-sm animate-pulse">warning</span>High ({risk}%)</span>;
    if (risk >= 40) return <span className="text-xs font-bold text-yellow-400">Medium ({risk}%)</span>;
    return <span className="text-xs font-bold text-success">Low ({risk}%)</span>;
  };

  const handleStatusUpdate = async (bookingId, newStatus) => {
    setUpdatingId(bookingId);
    try {
      // Find the booking data from our local state
      const booking = appointments.find(a => a.id === bookingId);

      // Update booking status
      await updateDoc(doc(db, 'bookings', bookingId), { status: newStatus });

      // If ACCEPTING a booking, handle loyalty points
      if (newStatus === 'confirmed' && booking) {
        const customerId = booking.customerId;
        const finalCost = booking.finalCost || 0;

        // 1. Award points: 1 point per LOYALTY_EARN_RATE LKR spent
        const pointsEarned = Math.floor(finalCost / LOYALTY_EARN_RATE);
        if (pointsEarned > 0) {
          // Add points to customer's balance
          await updateDoc(doc(db, 'users', customerId), {
            loyaltyPoints: increment(pointsEarned)
          });

          // Log the earning
          await addDoc(collection(db, 'loyaltyLogs'), {
            customerId: customerId,
            customerName: booking.customerName || 'Unknown',
            salonId: booking.salonId,
            action: `Earned: ${booking.services?.map(s => s.name).join(', ') || 'Booking'}`,
            points: pointsEarned,
            type: 'earn',
            bookingId: bookingId,
            createdAt: serverTimestamp()
          });
        }

        // 2. If customer used loyalty points, deduct them
        if (booking.usedLoyaltyPoints) {
          await updateDoc(doc(db, 'users', customerId), {
            loyaltyPoints: increment(-LOYALTY_REDEEM_COST)
          });

          // Log the redemption
          await addDoc(collection(db, 'loyaltyLogs'), {
            customerId: customerId,
            customerName: booking.customerName || 'Unknown',
            salonId: booking.salonId,
            action: `Redeemed: ${formatLKR(booking.discount || 0)} discount`,
            points: -LOYALTY_REDEEM_COST,
            type: 'redeem',
            bookingId: bookingId,
            createdAt: serverTimestamp()
          });
        }
      }
    } catch (err) {
      console.error('Failed to update booking status:', err);
      alert('Failed to update booking status. Please try again.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <AdminLayout activePage="appointments">
      <header className="h-20 px-8 flex items-center justify-between shrink-0 bg-background-dark/80 backdrop-blur-sm z-10 sticky top-0 border-b border-white/5">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Manage Appointments</h2>
          <p className="text-text-secondary text-sm mt-0.5">View and manage your salon's bookings in real-time.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-card-dark border border-white/10 rounded-lg text-sm overflow-hidden">
            {[
              { key: 'all', label: 'All' },
              { key: 'pending', label: 'Pending' },
              { key: 'confirmed', label: 'Confirmed' },
              { key: 'cancelled', label: 'Cancelled' },
              { key: 'no_show', label: 'No-Show' },
            ].map(f => (
              <button key={f.key} onClick={() => setFilterStatus(f.key)}
                className={`px-3 py-1.5 transition-colors ${filterStatus === f.key ? 'text-white bg-primary/20 border-x border-primary/50' : 'text-text-secondary hover:text-white'}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 pt-6 space-y-6 custom-scrollbar">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card-dark rounded-xl p-4 border border-white/5">
            <p className="text-text-secondary text-xs font-medium uppercase tracking-wider">Total Bookings</p>
            <p className="text-2xl font-bold text-white mt-1">{appointments.length}</p>
          </div>
          <div className="bg-card-dark rounded-xl p-4 border border-white/5">
            <p className="text-text-secondary text-xs font-medium uppercase tracking-wider">Confirmed</p>
            <p className="text-2xl font-bold text-success mt-1">{appointments.filter(a => a.status === 'confirmed').length}</p>
          </div>
          <div className="bg-card-dark rounded-xl p-4 border border-white/5">
            <p className="text-text-secondary text-xs font-medium uppercase tracking-wider">Revenue</p>
            <p className="text-2xl font-bold text-white mt-1">{formatLKR(appointments.filter(a => a.status === 'confirmed').reduce((sum, a) => sum + (a.finalCost || 0), 0))}</p>
          </div>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
            <p className="text-text-secondary text-sm">Loading appointments...</p>
          </div>
        )}

        {error && !loading && (<div className="bg-danger/10 border border-danger/30 text-danger p-4 rounded-xl text-center"><p>{error}</p></div>)}

        {!loading && !error && filteredAppointments.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <span className="material-symbols-outlined text-6xl text-text-secondary/30">event_busy</span>
            <h3 className="text-xl font-bold text-white">No Appointments Found</h3>
            <p className="text-text-secondary max-w-sm">{filterStatus === 'all' ? "No bookings yet." : `No ${filterStatus} appointments found.`}</p>
          </div>
        )}

        {!loading && !error && filteredAppointments.length > 0 && (
          <div className="bg-card-dark border border-white/5 rounded-2xl overflow-hidden shadow-xl ring-1 ring-white/5">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 text-text-secondary text-xs uppercase tracking-wider font-semibold border-b border-white/5">
                    <th className="p-4">Date & Time</th>
                    <th className="p-4">Customer</th>
                    <th className="p-4">Services</th>
                    <th className="p-4">Stylist</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">AI Risk <span className="text-primary ml-1">ⓘ</span></th>
                    <th className="p-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredAppointments.map((appt) => (
                    <tr key={appt.id} className={`group hover:bg-white/5 transition-colors ${appt.status === 'pending' ? 'border-l-2 border-l-yellow-500/50' : ''}`}>
                      <td className="p-4"><p className="text-sm font-medium text-white">{getFormattedDate(appt)}</p><p className="text-xs text-text-secondary">{appt.time}</p></td>
                      <td className="p-4"><p className="text-sm font-medium text-white">{appt.customerName}</p><p className="text-xs text-text-secondary">{appt.customerEmail}</p></td>
                      <td className="p-4"><p className="text-sm text-white max-w-[200px] truncate">{getServiceNames(appt.services)}</p></td>
                      <td className="p-4 text-sm text-text-secondary">{appt.stylist}</td>
                      <td className="p-4"><p className="text-sm font-medium text-white">{formatLKR(appt.finalCost)}</p><p className="text-xs text-text-secondary">{appt.paymentMethod === 'online' ? 'Online' : 'At Salon'}</p></td>
                      <td className="p-4">{getStatusBadge(appt.status)}</td>
                      <td className="p-4">{getRiskBadge(appt.noShowRisk)}</td>
                      <td className="p-4">
                        {appt.status === 'pending' ? (
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleStatusUpdate(appt.id, 'confirmed')} disabled={updatingId === appt.id}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-success/10 text-success border border-success/20 text-xs font-bold hover:bg-success/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                              <span className="material-symbols-outlined text-sm">check</span>Accept
                            </button>
                            <button onClick={() => handleStatusUpdate(appt.id, 'cancelled')} disabled={updatingId === appt.id}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-danger/10 text-danger border border-danger/20 text-xs font-bold hover:bg-danger/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                              <span className="material-symbols-outlined text-sm">close</span>Decline
                            </button>
                          </div>
                        ) : appt.status === 'confirmed' ? (
                          <button onClick={() => handleStatusUpdate(appt.id, 'no_show')} disabled={updatingId === appt.id}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 text-xs font-bold hover:bg-orange-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            <span className="material-symbols-outlined text-sm">person_off</span>No-Show
                          </button>
                        ) : <span className="text-xs text-text-secondary italic">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminAppointments;