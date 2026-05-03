import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from './firebase';
import { useAuth } from './AuthContext';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import CustomerLayout from './CustomerLayout';
import { formatLKR } from './utils/formatLKR';
import { LOYALTY_EARN_RATE, LOYALTY_REDEEM_COST } from './BookingContext';

function MyAppointments() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Review modal state
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewBooking, setReviewBooking] = useState(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewedBookingIds, setReviewedBookingIds] = useState(new Set());

  useEffect(() => {
    if (!currentUser) return;
    try {
      const q = query(collection(db, 'bookings'), where('customerId', '==', currentUser.uid), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setAppointments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      }, (err) => {
        console.error('Error fetching appointments:', err);
        setError('Failed to load your appointments. Please try again.');
        setLoading(false);
      });
      return () => unsubscribe();
    } catch (err) {
      setError('Failed to connect to the database.');
      setLoading(false);
    }
  }, [currentUser]);

  // Fetch which bookings have already been reviewed
  useEffect(() => {
    if (!currentUser) return;
    const fetchReviewed = async () => {
      try {
        const q = query(collection(db, 'reviews'), where('customerId', '==', currentUser.uid));
        const snapshot = await getDocs(q);
        const ids = new Set(snapshot.docs.map(d => d.data().bookingId));
        setReviewedBookingIds(ids);
      } catch (err) {
        console.error('Error fetching reviews:', err);
      }
    };
    fetchReviewed();
  }, [currentUser]);

  const openReviewModal = (appt) => {
    setReviewBooking(appt);
    setReviewRating(0);
    setReviewHover(0);
    setReviewText('');
    setReviewError('');
    setReviewModalOpen(true);
  };

  const handleSubmitReview = async () => {
    if (reviewRating === 0) { setReviewError('Please select a star rating.'); return; }
    if (!reviewText.trim()) { setReviewError('Please write a short review.'); return; }
    setReviewSubmitting(true);
    setReviewError('');
    try {
      await addDoc(collection(db, 'reviews'), {
        salonId: reviewBooking.salonId,
        customerId: currentUser.uid,
        customerName: reviewBooking.customerName || currentUser.displayName || 'Customer',
        bookingId: reviewBooking.id,
        rating: reviewRating,
        text: reviewText.trim(),
        createdAt: serverTimestamp()
      });
      setReviewedBookingIds(prev => new Set([...prev, reviewBooking.id]));
      setReviewModalOpen(false);

      // Notify the salon owner about the new review
      try {
        await addDoc(collection(db, 'notifications'), {
          userId: reviewBooking.salonId,
          title: 'New Review',
          message: `${currentUser.displayName || 'A customer'} left a ${reviewRating}-star review for ${reviewBooking.services?.map(s => s.name).join(', ') || 'a service'}.`,
          type: 'review',
          read: false,
          createdAt: serverTimestamp(),
        });
      } catch (notifErr) {
        console.warn('Notification failed (non-blocking):', notifErr);
      }
    } catch (err) {
      console.error('Error submitting review:', err);
      setReviewError('Failed to submit review. Please try again.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const getServiceNames = (services) => (!services || services.length === 0) ? 'No services' : services.map(s => s.name).join(', ');
  const getFormattedDate = (appt) => (!appt.month || !appt.date || !appt.year) ? 'Date not set' : `${appt.month.slice(0, 3)} ${appt.date}, ${appt.year}`;
  const getStatusStyle = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'confirmed': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'cancelled': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'no_show': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'completed': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  return (
    <CustomerLayout activePage="my-appointments">
      <header className="flex flex-col md:flex-row md:justify-between md:items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter text-text-primary">My Appointments</h1>
          <p className="text-text-secondary mt-1">Manage your upcoming salon visits and treatment plans.</p>
        </div>
        <button onClick={() => navigate('/home')} className="bg-brand-purple hover:bg-[#9f7aea] text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-glow w-full md:w-auto">
          <span className="material-symbols-outlined text-lg">add</span>
          Book New Appointment
        </button>
      </header>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-10 h-10 border-4 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin"></div>
          <p className="text-text-secondary text-sm">Loading your appointments...</p>
        </div>
      )}
      {error && !loading && (<div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-center max-w-lg mx-auto"><p>{error}</p></div>)}
      {!loading && !error && appointments.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <span className="material-symbols-outlined text-6xl text-text-secondary/30">calendar_month</span>
          <h3 className="text-xl font-bold text-text-primary">No Appointments Yet</h3>
          <p className="text-text-secondary max-w-sm">You haven't booked any appointments yet. Browse salons and book your first look!</p>
          <button onClick={() => navigate('/home')} className="mt-2 bg-brand-purple hover:bg-[#9f7aea] text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-glow">Explore Salons</button>
        </div>
      )}
      {!loading && !error && appointments.length > 0 && (
        <section className="space-y-4 max-w-4xl">
          {appointments.map((appt) => (
            <article key={appt.id} className="bg-surface rounded-2xl p-4 md:p-6 flex flex-col md:flex-row items-start md:items-center gap-6 border border-border-color hover:border-brand-purple/50 shadow-sm hover:shadow-glow-primary-md transition-all duration-300">
              <div className="w-full md:w-32 h-32 rounded-xl bg-brand-purple/10 border border-brand-purple/20 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-5xl text-brand-purple/60">content_cut</span>
              </div>
              <div className="flex-1 w-full">
                <div className="flex flex-wrap items-center gap-3 mb-1">
                  <h3 className="text-lg md:text-xl font-bold text-text-primary">{getServiceNames(appt.services)}</h3>
                  <span className={`${getStatusStyle(appt.status)} border px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider`}>{appt.status === 'no_show' ? 'No-Show' : appt.status}</span>
                </div>
                <p className="text-text-secondary text-sm mb-4">{appt.salonName || 'Unknown Salon'}</p>
                <div className="flex flex-wrap items-center gap-4 text-sm text-text-accent">
                  <div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-base">calendar_today</span><span className="font-medium text-text-primary">{getFormattedDate(appt)}</span></div>
                  <div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-base">schedule</span><span className="font-medium text-text-primary">{appt.time}</span></div>
                  <div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-base">person</span><span className="font-medium text-text-primary">{appt.stylist}</span></div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-white">{formatLKR(appt.finalCost)}</span>
                  {appt.usedLoyaltyPoints && (<span className="text-xs text-[#FFD700] bg-[#FFD700]/10 px-2 py-0.5 rounded-full border border-[#FFD700]/20">-{LOYALTY_REDEEM_COST} pts redeemed</span>)}
                  {appt.status === 'confirmed' && (
                    <span className="text-xs text-success bg-success/10 px-2 py-0.5 rounded-full border border-success/20">
                      +{Math.floor((appt.finalCost || 0) / LOYALTY_EARN_RATE)} pts earned
                    </span>
                  )}
                  <span className="text-xs text-text-secondary">• {appt.paymentMethod === 'online' ? 'Paid Online' : 'Pay at Salon'}</span>
                </div>
              </div>
              <div className="flex flex-row md:flex-col gap-3 w-full md:w-auto shrink-0 mt-2 md:mt-0">
                {appt.status === 'pending' && (
                  <button className="flex-1 md:flex-none px-6 py-2 border border-border-color rounded-lg text-sm font-semibold text-text-primary hover:bg-white/5 transition-colors">Awaiting Confirmation</button>
                )}
                {appt.status === 'confirmed' && !reviewedBookingIds.has(appt.id) && (
                  <button onClick={() => openReviewModal(appt)} className="flex-1 md:flex-none px-6 py-2 bg-brand-purple/20 border border-brand-purple/50 rounded-lg text-sm font-semibold text-[#8b5cf6] hover:bg-brand-purple/30 transition-colors flex items-center justify-center gap-1.5">
                    <span className="material-symbols-outlined text-base">star</span>Leave Review
                  </button>
                )}
                {appt.status === 'confirmed' && reviewedBookingIds.has(appt.id) && (
                  <span className="flex-1 md:flex-none px-6 py-2 text-sm font-semibold text-success flex items-center justify-center gap-1.5">
                    <span className="material-symbols-outlined text-base">check_circle</span>Reviewed
                  </span>
                )}
                {appt.status === 'cancelled' && (
                  <span className="flex-1 md:flex-none px-6 py-2 text-sm font-semibold text-text-secondary text-center">Cancelled</span>
                )}
              </div>
            </article>
          ))}
        </section>
      )}

      {/* Review Modal */}
      {reviewModalOpen && reviewBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setReviewModalOpen(false)}></div>
          <div className="relative w-full max-w-md bg-[#1A1B26] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
              <h3 className="text-white text-lg font-bold">Leave a Review</h3>
              <button onClick={() => setReviewModalOpen(false)} className="text-text-secondary hover:text-white transition-colors"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="p-6 flex flex-col gap-5">
              <div>
                <p className="text-sm text-text-secondary">Reviewing your visit to</p>
                <p className="text-white font-bold">{reviewBooking.salonName}</p>
                <p className="text-xs text-text-secondary mt-1">{getServiceNames(reviewBooking.services)}</p>
              </div>

              {/* Star Rating */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-white">Your Rating</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} onClick={() => setReviewRating(star)} onMouseEnter={() => setReviewHover(star)} onMouseLeave={() => setReviewHover(0)}
                      className="transition-transform hover:scale-110">
                      <svg className={`w-8 h-8 ${(reviewHover || reviewRating) >= star ? 'text-[#FFD700]' : 'text-gray-600'} transition-colors`} fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                      </svg>
                    </button>
                  ))}
                </div>
              </div>

              {/* Review Text */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-white">Your Review</label>
                <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)}
                  className="w-full bg-background-dark border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple placeholder-text-secondary/50 resize-none"
                  placeholder="How was your experience?" rows="4"></textarea>
              </div>

              {reviewError && <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-sm p-3 rounded-lg text-center">{reviewError}</div>}
            </div>
            <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3 bg-white/5">
              <button onClick={() => setReviewModalOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-white hover:bg-white/10 transition-colors">Cancel</button>
              <button onClick={handleSubmitReview} disabled={reviewSubmitting}
                className="px-6 py-2 rounded-lg text-sm font-bold text-white bg-brand-purple hover:bg-[#8b5cf6] shadow-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </CustomerLayout>
  );
}

export default MyAppointments;