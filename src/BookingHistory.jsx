import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from './firebase';
import { useAuth } from './AuthContext';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import CustomerLayout from './CustomerLayout';
import { formatLKR } from './utils/formatLKR';

const BookingHistory = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [activeFilter, setActiveFilter] = useState('All');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch all bookings for this customer
  useEffect(() => {
    if (!currentUser) return;
    try {
      const q = query(
        collection(db, 'bookings'),
        where('customerId', '==', currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      }, (err) => {
        console.error('Error fetching booking history:', err);
        setError('Failed to load your booking history.');
        setLoading(false);
      });
      return () => unsubscribe();
    } catch (err) {
      setError('Failed to connect to the database.');
      setLoading(false);
    }
  }, [currentUser]);

  // Filter logic
  const filteredBookings = bookings.filter(b => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Completed') return b.status === 'confirmed' || b.status === 'completed';
    if (activeFilter === 'Cancelled') return b.status === 'cancelled';
    if (activeFilter === 'No-Show') return b.status === 'no_show';
    return true;
  });

  const getServiceNames = (services) => (!services || services.length === 0) ? 'No services' : services.map(s => s.name).join(', ');
  const getFormattedDate = (appt) => (!appt.month || !appt.date || !appt.year) ? 'Date not set' : `${appt.month.slice(0, 3)} ${appt.date}, ${appt.year}`;

  const getStatusStyle = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'confirmed': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'completed': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'cancelled': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'no_show': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const getStatusLabel = (status) => {
    if (status === 'no_show') return 'No-Show';
    if (status === 'confirmed') return 'Completed';
    return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
  };

  return (
    <CustomerLayout activePage="booking-history">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tighter text-white mb-2">Booking History</h1>
        <p className="text-text-secondary text-lg">Review your past appointments and easily rebook your favorite services.</p>
      </header>

      {/* Filters */}
      <section className="mb-8 flex flex-wrap gap-3">
        {['All', 'Completed', 'Cancelled', 'No-Show'].map(filter => (
          <button key={filter} onClick={() => setActiveFilter(filter)}
            className={`px-6 py-2 rounded-full font-medium transition-colors border ${
              activeFilter === filter ? 'bg-brand-purple text-white border-brand-purple' : 'bg-card-dark text-text-secondary border-white/10 hover:bg-white/5 hover:text-white'
            }`}>
            {filter}
          </button>
        ))}
      </section>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-10 h-10 border-4 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin"></div>
          <p className="text-text-secondary text-sm">Loading booking history...</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-center max-w-lg mx-auto"><p>{error}</p></div>
      )}

      {/* Empty State */}
      {!loading && !error && bookings.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <span className="material-symbols-outlined text-6xl text-text-secondary/30">history</span>
          <h3 className="text-xl font-bold text-white">No Booking History</h3>
          <p className="text-text-secondary max-w-sm">Your past bookings will appear here once you've completed appointments.</p>
          <button onClick={() => navigate('/home')} className="mt-2 bg-brand-purple hover:bg-[#9f7aea] text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-glow">
            Explore Salons
          </button>
        </div>
      )}

      {/* No filter results */}
      {!loading && !error && bookings.length > 0 && filteredBookings.length === 0 && (
        <div className="text-center py-10 text-text-secondary">No {activeFilter.toLowerCase()} appointments found.</div>
      )}

      {/* Bookings List */}
      {!loading && !error && filteredBookings.length > 0 && (
        <section className="space-y-4 max-w-5xl">
          {filteredBookings.map((item) => (
            <div key={item.id} className="bg-card-dark border border-white/5 rounded-xl p-6 flex flex-col md:flex-row md:items-center gap-6 transition-all duration-200 hover:border-brand-purple/50 hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
              
              {/* Date & Time */}
              <div className="w-full md:w-40 shrink-0">
                <div className="text-white font-semibold">{getFormattedDate(item)}</div>
                <div className="text-text-secondary text-sm">{item.time}</div>
              </div>
              
              {/* Salon & Service */}
              <div className="flex-1">
                <div className="text-white font-bold text-lg">{item.salonName || 'Unknown Salon'}</div>
                <div className="text-text-secondary">{getServiceNames(item.services)}</div>
              </div>
              
              {/* Cost & Status */}
              <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto mt-2 md:mt-0">
                <div className="text-white font-semibold whitespace-nowrap">{formatLKR(item.finalCost)}</div>
                <span className={`${getStatusStyle(item.status)} border px-4 py-1.5 rounded-full text-sm font-medium`}>
                  {getStatusLabel(item.status)}
                </span>
              </div>
              
              {/* Actions */}
              <div className="flex gap-3 w-full md:w-auto mt-4 md:mt-0">
                <button 
                  onClick={() => item.salonId ? navigate(`/salon/${item.salonId}`) : null}
                  className="flex-1 md:flex-none px-5 py-2 bg-brand-purple hover:bg-[#8b5cf6] text-white rounded-lg font-semibold text-sm transition-colors shadow-[0_4px_15px_rgba(107,70,193,0.2)]">
                  Rebook
                </button>
              </div>
            </div>
          ))}
        </section>
      )}
    </CustomerLayout>
  );
};

export default BookingHistory;