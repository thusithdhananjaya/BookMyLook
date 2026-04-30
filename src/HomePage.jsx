import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { db } from './firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import CustomerLayout from './CustomerLayout';

function HomePage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [salons, setSalons] = useState([]);
  const [salonsLoading, setSalonsLoading] = useState(true);

  // Fetch approved salons and their review ratings
  useEffect(() => {
    const fetchSalons = async () => {
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'admin'), where('status', '==', 'approved'));
        const snapshot = await getDocs(q);
        const salonList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        // Fetch all reviews in one query and compute per-salon ratings
        const reviewsSnap = await getDocs(collection(db, 'reviews'));
        const reviewsBySalon = {};
        reviewsSnap.docs.forEach(d => {
          const data = d.data();
          if (!reviewsBySalon[data.salonId]) reviewsBySalon[data.salonId] = [];
          reviewsBySalon[data.salonId].push(data.rating);
        });

        // Attach rating data to each salon
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

  // Placeholder images for salons that don't have logos yet
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
        {/* Upcoming Appointment Card */}
        <div className="lg:col-span-2">
          <h2 className="mb-4 text-xl font-semibold tracking-tight text-text-accent">Upcoming Appointments</h2>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-4 rounded-xl border border-border-color bg-surface p-4 backdrop-blur-xl transition-all hover:border-brand-purple/50 shadow-glow-primary-md">
              <img src="/homepagesalon1.jpg" alt="Salon" className="w-full sm:w-28 h-28 object-cover rounded-lg" />
              <div className="flex-1 text-center sm:text-left">
                <p className="font-bold text-text-primary">Haircut & Style</p>
                <p className="text-sm text-text-secondary">The Modern Salon with Alex Stylist</p>
                <div className="mt-2 flex items-center justify-center sm:justify-start gap-4 text-sm text-text-accent">
                  <div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-base">calendar_today</span><span>Oct 26, 2024</span></div>
                  <div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-base">schedule</span><span>2:00 PM</span></div>
                </div>
              </div>
              <button onClick={() => navigate('/my-appointments')} className="mt-2 sm:mt-0 flex items-center justify-center rounded-lg h-10 px-4 bg-brand-purple text-sm font-bold shadow-glow hover:brightness-110 transition-all text-white">Manage</button>
            </div>
          </div>
        </div>

        {/* Leave Review Card */}
        <div className="lg:col-span-1">
          <h2 className="mb-4 text-xl font-semibold tracking-tight text-text-accent">Leave a Review</h2>
          <div className="relative overflow-hidden flex flex-col items-start justify-between rounded-xl border border-border-color bg-surface p-6 backdrop-blur-xl min-h-[172px]">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-purple/20 to-transparent opacity-50"></div>
            <div className="relative z-10"><p className="font-bold text-text-primary">How was your last visit?</p><p className="text-sm text-text-secondary mt-1">Review 'Ombre Coloring' at Chroma Salon.</p></div>
            <button className="relative z-10 mt-4 flex items-center justify-center rounded-lg h-10 px-5 bg-brand-purple/30 border border-brand-purple/50 text-text-primary text-sm font-bold hover:bg-brand-purple/50 transition-colors"><span className="material-symbols-outlined text-lg mr-2">star</span>Write Review</button>
          </div>
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