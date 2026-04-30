import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import AdminLayout from './AdminLayout';

const AdminReviews = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      const q = query(
        collection(db, 'reviews'),
        where('salonId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const unsubSnapshot = onSnapshot(q, (snapshot) => {
        setReviews(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }, (err) => {
        console.error('Error fetching reviews:', err);
        setLoading(false);
      });
      return () => unsubSnapshot();
    });
    return () => unsubAuth();
  }, []);

  // Computed metrics
  const avgRating = reviews.length > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : '0.0';
  const ratingCounts = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: reviews.filter(r => r.rating === star).length,
    pct: reviews.length > 0 ? Math.round((reviews.filter(r => r.rating === star).length / reviews.length) * 100) : 0
  }));

  const renderStars = (rating) => (
    <div className="flex items-center gap-0.5">
      {[...Array(5)].map((_, i) => (
        <svg key={i} className={`w-4 h-4 ${i < rating ? 'text-[#FFD700]' : 'text-gray-600'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
        </svg>
      ))}
    </div>
  );

  return (
    <AdminLayout activePage="reviews">
      <header className="h-20 px-8 flex items-center justify-between shrink-0 bg-background-dark/80 backdrop-blur-sm z-10 sticky top-0 border-b border-white/5">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Customer Reviews</h2>
          <p className="text-text-secondary text-sm mt-0.5">{reviews.length} review{reviews.length !== 1 ? 's' : ''} received</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 pt-6 space-y-8 custom-scrollbar">

        {/* Rating Overview */}
        {!loading && reviews.length > 0 && (
          <section className="bg-card-dark rounded-2xl p-6 border border-white/5">
            <div className="flex flex-col md:flex-row gap-8 items-center">
              {/* Big Rating */}
              <div className="text-center">
                <p className="text-6xl font-black text-white">{avgRating}</p>
                <div className="flex justify-center mt-2">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className={`w-5 h-5 ${i < Math.round(Number(avgRating)) ? 'text-[#FFD700]' : 'text-gray-600'}`} fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                    </svg>
                  ))}
                </div>
                <p className="text-text-secondary text-sm mt-1">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</p>
              </div>

              {/* Rating Breakdown */}
              <div className="flex-1 w-full space-y-2">
                {ratingCounts.map(({ star, count, pct }) => (
                  <div key={star} className="flex items-center gap-3">
                    <span className="text-sm text-text-secondary w-8 text-right">{star} ★</span>
                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-[#FFD700] rounded-full transition-all duration-500" style={{ width: `${pct}%` }}></div>
                    </div>
                    <span className="text-xs text-text-secondary w-12">{count} ({pct}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
            <p className="text-text-secondary text-sm">Loading reviews...</p>
          </div>
        )}

        {/* Empty */}
        {!loading && reviews.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <span className="material-symbols-outlined text-6xl text-text-secondary/30">rate_review</span>
            <h3 className="text-xl font-bold text-white">No Reviews Yet</h3>
            <p className="text-text-secondary max-w-sm">When customers leave reviews after their appointments, they'll appear here.</p>
          </div>
        )}

        {/* Reviews List */}
        {!loading && reviews.length > 0 && (
          <section className="space-y-4">
            <h3 className="text-lg font-bold text-white tracking-tight">All Reviews</h3>
            {reviews.map((review) => (
              <div key={review.id} className="bg-card-dark rounded-xl p-6 border border-white/5 hover:border-primary/30 transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-bold text-white">{review.customerName}</h4>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {review.createdAt?.toDate
                        ? review.createdAt.toDate().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                        : 'Recently'}
                    </p>
                  </div>
                  {renderStars(review.rating)}
                </div>
                <p className="text-sm text-text-secondary leading-relaxed">"{review.text}"</p>
              </div>
            ))}
          </section>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminReviews;