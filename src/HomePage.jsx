import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { db } from './firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import CustomerLayout from './CustomerLayout';

function HomePage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [salons, setSalons] = useState([]);
  const [salonsLoading, setSalonsLoading] = useState(true);

  // Upcoming appointment state
  const [upcomingBooking, setUpcomingBooking] = useState(null);

  // Review state
  const [reviewableBooking, setReviewableBooking] = useState(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewDone, setReviewDone] = useState(false);

  // Fetch salons with ratings
  useEffect(() => {
    const fetchSalons = async () => {
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'admin'), where('status', '==', 'approved'));
        const snapshot = await getDocs(q);
        const salonList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        const reviewsSnap = await getDocs(collection(db, 'reviews'));
        const reviewsBySalon = {};
        reviewsSnap.docs.forEach(d => {
          const data = d.data();
          if (!reviewsBySalon[data.salonId]) reviewsBySalon[data.salonId] = [];
          reviewsBySalon[data.salonId].push(data.rating);
        });

        const salonsWithRatings = salonList.map(salon => {
          const ratings = reviewsBySalon[salon.id] || [];
          const avg = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null;
          return { ...salon, avgRating: avg, reviewCount: ratings.length };
        });

        setSalons(salonsWithRatings);
      } catch (err) {
        console.error('Error fetching salons:', err);
      } finally {
        setSalonsLoading(false);
      }
    };
    fetchSalons();
  }, []);

  // Fetch upcoming booking + reviewable booking
  useEffect(() => {
    const fetchBookings = async () => {
      if (!currentUser) return;
      try {
        // Get all bookings for this customer
        const bookingsQuery = query(collection(db, 'bookings'), where('customerId', '==', currentUser.uid));
        const bookingsSnap = await getDocs(bookingsQuery);
        const bookings = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Find latest pending or confirmed booking as "upcoming"
        const upcoming = bookings
          .filter(b => b.status === 'pending' || b.status === 'confirmed')
          .sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
            return dateB - dateA;
          })[0];
        setUpcomingBooking(upcoming || null);

        // Find latest confirmed booking that hasn't been reviewed
        const reviewsQuery = query(collection(db, 'reviews'), where('customerId', '==', currentUser.uid));
        const reviewsSnap = await getDocs(reviewsQuery);
        const reviewedBookingIds = new Set(reviewsSnap.docs.map(d => d.data().bookingId));

        const reviewable = bookings
          .filter(b => b.status === 'confirmed' && !reviewedBookingIds.has(b.id))
          .sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
            return dateB - dateA;
          })[0];
        setReviewableBooking(reviewable || null);
      } catch (err) {
        console.error('Error fetching bookings:', err);
      }
    };
    fetchBookings();
  }, [currentUser]);

  const getServiceNames = (services) => (!services || services.length === 0) ? 'Service' : services.map(s => s.name).join(', ');

  // Review submission
  const handleSubmitReview = async () => {
    if (reviewRating === 0) { setReviewError('Please select a star rating.'); return; }
    if (!reviewText.trim()) { setReviewError('Please write a short review.'); return; }
    setReviewSubmitting(true);
    setReviewError('');
    try {
      await addDoc(collection(db, 'reviews'), {
        salonId: reviewableBooking.salonId,
        customerId: currentUser.uid,
        customerName: reviewableBooking.customerName || currentUser.displayName || 'Customer',
        bookingId: reviewableBooking.id,
        rating: reviewRating,
        text: reviewText.trim(),
        createdAt: serverTimestamp(),
      });
      setReviewModalOpen(false);
      setReviewDone(true);
      setReviewableBooking(null);
    } catch (err) {
      console.error('Error submitting review:', err);
      setReviewError('Failed to submit review. Please try again.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const placeholderImages = ['/homepagesalon1.jpg', '/homepagesalon2.jpg', '/homepagesalon3.jpg', '/homepagesalon4.jpg', '/homepagesalon5.jpg', '/homepagesalon6.jpg'];

  return (
    <CustomerLayout activePage="dashboard">
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-bold tracking-tighter text-text-primary animate-[fadeIn_1.2s_ease-in-out_forwards] opacity-0">
          Welcome Back, {currentUser?.displayName || 'User'}!
        </h1>
        <p className="text-text-secondary">Here's your personalized salon dashboard.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Upcoming Appointment Card — Dynamic */}
        <div className="lg:col-span-2">
          <h2 className="mb-4 text-xl font-semibold tracking-tight text-text-accent">Upcoming Appointments</h2>
          {upcomingBooking ? (
            <div className="flex flex-col sm:flex-row items-center gap-4 rounded-xl border border-border-color bg-surface p-4 backdrop-blur-xl transition-all hover:border-brand-purple/50 shadow-glow-primary-md">
              <div className="w-full sm:w-28 h-28 rounded-lg bg-brand-purple/20 flex items-center justify-center overflow-hidden">
                <img src={placeholderImages[0]} alt="Salon" className="w-full h-full object-cover rounded-lg" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <p className="font-bold text-text-primary">{getServiceNames(upcomingBooking.services)}</p>
                <p className="text-sm text-text-secondary">{upcomingBooking.salonName} with {upcomingBooking.stylist || 'Any Stylist'}</p>
                <div className="mt-2 flex items-center justify-center sm:justify-start gap-4 text-sm text-text-accent">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base">calendar_today</span>
                    <span>{upcomingBooking.month?.slice(0, 3)} {upcomingBooking.date}, {upcomingBooking.year}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base">schedule</span>
                    <span>{upcomingBooking.time}</span>
                  </div>
                </div>
                <span className={`inline-block mt-2 text-xs font-bold px-2.5 py-0.5 rounded-full ${
                  upcomingBooking.status === 'confirmed' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                }`}>{upcomingBooking.status === 'confirmed' ? 'Confirmed' : 'Pending'}</span>
              </div>
              <button onClick={() => navigate('/my-appointments')} className="mt-2 sm:mt-0 flex items-center justify-center rounded-lg h-10 px-4 bg-brand-purple text-sm font-bold shadow-glow hover:brightness-110 transition-all text-white">Manage</button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border-color bg-surface p-8 text-center">
              <span className="material-symbols-outlined text-4xl text-text-secondary/30 mb-2">calendar_month</span>
              <p className="text-text-secondary text-sm">No upcoming appointments.</p>
              <button onClick={() => navigate('/home')} className="mt-3 text-sm font-semibold text-brand-purple hover:text-[#8b5cf6] transition-colors">Browse Salons →</button>
            </div>
          )}
        </div>

        {/* Leave Review Card — Dynamic */}
        <div className="lg:col-span-1">
          <h2 className="mb-4 text-xl font-semibold tracking-tight text-text-accent">Leave a Review</h2>
          {reviewableBooking && !reviewDone ? (
            <div className="relative overflow-hidden flex flex-col items-start justify-between rounded-xl border border-border-color bg-surface p-6 backdrop-blur-xl min-h-[172px]">
              <div className="absolute inset-0 bg-gradient-to-br from-brand-purple/20 to-transparent opacity-50"></div>
              <div className="relative z-10">
                <p className="font-bold text-text-primary">How was your last visit?</p>
                <p className="text-sm text-text-secondary mt-1">Review '{getServiceNames(reviewableBooking.services)}' at {reviewableBooking.salonName}.</p>
              </div>
              <button onClick={() => { setReviewRating(0); setReviewHover(0); setReviewText(''); setReviewError(''); setReviewModalOpen(true); }}
                className="relative z-10 mt-4 flex items-center justify-center rounded-lg h-10 px-5 bg-brand-purple/30 border border-brand-purple/50 text-text-primary text-sm font-bold hover:bg-brand-purple/50 transition-colors">
                <span className="material-symbols-outlined text-lg mr-2">star</span>Write Review
              </button>
            </div>
          ) : (
            <div className="relative overflow-hidden flex flex-col items-center justify-center rounded-xl border border-border-color bg-surface p-6 backdrop-blur-xl min-h-[172px] text-center">
              <div className="absolute inset-0 bg-gradient-to-br from-brand-purple/20 to-transparent opacity-50"></div>
              <span className="material-symbols-outlined text-3xl text-green-400/50 relative z-10 mb-2">{reviewDone ? 'check_circle' : 'rate_review'}</span>
              <p className="text-sm text-text-secondary relative z-10">{reviewDone ? 'Thanks for your review!' : 'No bookings to review right now.'}</p>
            </div>
          )}
        </div>

        {/* Dynamic Salon Grid */}
        <div className="lg:col-span-3 mt-4">
          <h2 className="mb-4 text-xl font-semibold tracking-tight text-text-accent">Recommended For You</h2>
          
          {salonsLoading && (
            <div className="flex items-center justify-center py-10">
              <div className="w-8 h-8 border-4 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin"></div>
            </div>
          )}

          {!salonsLoading && salons.length === 0 && (
            <p className="text-text-secondary text-center py-10">No salons available yet. Check back soon!</p>
          )}

          {!salonsLoading && salons.length > 0 && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {salons.map((salon, idx) => (
                <div key={salon.id} onClick={() => navigate(`/salon/${salon.id}`)} className="cursor-pointer transition-transform hover:scale-[1.02]">
                  <SalonCard 
                    image={salon.logoUrl || placeholderImages[idx % placeholderImages.length]} 
                    name={salon.salonName || 'Unnamed Salon'} 
                    desc={salon.aboutSalon?.slice(0, 60) || 'Beauty & grooming services.'} 
                    rating={salon.avgRating || 'New'} 
                    reviews={salon.reviewCount || 0} 
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Review Modal */}
      {reviewModalOpen && reviewableBooking && (
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
                <p className="text-white font-bold">{reviewableBooking.salonName}</p>
                <p className="text-xs text-text-secondary mt-1">{getServiceNames(reviewableBooking.services)}</p>
              </div>
              {/* Star Rating */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-white">Your Rating</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} onClick={() => setReviewRating(star)} onMouseEnter={() => setReviewHover(star)} onMouseLeave={() => setReviewHover(0)} className="transition-transform hover:scale-110">
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

function SalonCard({ image, name, desc, rating, reviews }) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border-color bg-surface backdrop-blur-xl transition-all hover:border-brand-purple/50 hover:shadow-glow-primary-md cursor-pointer">
      <div className="h-40 bg-cover bg-center transition-transform duration-500 group-hover:scale-105" style={{ backgroundImage: `url(${image})` }}></div>
      <div className="p-4">
        <h3 className="font-bold text-text-primary">{name}</h3>
        <p className="text-sm text-text-secondary">{desc}</p>
        <div className="mt-2 flex items-center gap-1 text-sm text-yellow-400">
          <span className="material-symbols-outlined text-[18px] fill-current">star</span>
          <span>{reviews > 0 ? `${rating} (${reviews} review${reviews !== 1 ? 's' : ''})` : 'New Salon'}</span>
        </div>
      </div>
    </div>
  );
}

export default HomePage;