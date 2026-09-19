import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from './firebase';
import { useAuth } from './AuthContext';
import { collection, doc, getDocs, getDoc, deleteDoc } from 'firebase/firestore';
import CustomerLayout from './CustomerLayout';

function SalonThumbnail({ image, fallbackImage, name }) {
  const [src, setSrc] = useState(image || fallbackImage);
  const [showInitials, setShowInitials] = useState(!image && !fallbackImage);
  const initials = (name || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  const handleError = () => {
    if (src !== fallbackImage && fallbackImage) {
      setSrc(fallbackImage); // logoUrl failed, try local placeholder
    } else {
      setShowInitials(true); // placeholder also failed, show initials
    }
  };

  if (showInitials) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-purple/50 to-brand-purple/10">
        <span className="text-3xl font-bold text-white/90 tracking-wide">{initials}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      onError={handleError}
      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
    />
  );
}

const SavedSalons = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [savedSalons, setSavedSalons] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch saved salon IDs, then fetch each salon's details
  useEffect(() => {
    const fetchSaved = async () => {
      if (!currentUser) return;
      try {
        // Get all docs in the savedSalons subcollection
        const savedSnap = await getDocs(collection(db, 'users', currentUser.uid, 'savedSalons'));
        const salonIds = savedSnap.docs.map(d => d.id);

        if (salonIds.length === 0) {
          setSavedSalons([]);
          setLoading(false);
          return;
        }

        // Fetch each salon's profile from the users collection
        const salons = [];
        for (const salonId of salonIds) {
          const salonDoc = await getDoc(doc(db, 'users', salonId));
          if (salonDoc.exists()) {
            salons.push({ id: salonDoc.id, ...salonDoc.data() });
          }
        }

        // Fetch reviews for ratings
        const reviewsSnap = await getDocs(collection(db, 'reviews'));
        const reviewsBySalon = {};
        reviewsSnap.docs.forEach(d => {
          const data = d.data();
          if (!reviewsBySalon[data.salonId]) reviewsBySalon[data.salonId] = [];
          reviewsBySalon[data.salonId].push(data.rating);
        });

        const salonsWithRatings = salons.map(salon => {
          const ratings = reviewsBySalon[salon.id] || [];
          const avg = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null;
          return { ...salon, avgRating: avg, reviewCount: ratings.length };
        });

        setSavedSalons(salonsWithRatings);
      } catch (err) {
        console.error('Error fetching saved salons:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSaved();
  }, [currentUser]);

  // Unsave a salon
  const handleUnsave = async (salonId) => {
    try {
      await deleteDoc(doc(db, 'users', currentUser.uid, 'savedSalons', salonId));
      setSavedSalons(prev => prev.filter(s => s.id !== salonId));
    } catch (err) {
      console.error('Error unsaving salon:', err);
    }
  };

  const placeholderImages = ['/homepagesalon1.jpg', '/homepagesalon2.jpg', '/homepagesalon3.jpg', '/homepagesalon4.jpg', '/homepagesalon5.jpg', '/homepagesalon6.jpg'];

  return (
    <CustomerLayout activePage="saved-salons">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tighter text-white mb-2">Saved Salons</h1>
        <p className="text-text-secondary text-lg">Your favorite spots for beauty and grooming.</p>
      </header>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-10 h-10 border-4 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin"></div>
          <p className="text-text-secondary text-sm">Loading saved salons...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && savedSalons.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="material-symbols-outlined text-6xl text-white/10 mb-4">heart_broken</span>
          <h3 className="text-xl font-bold text-white mb-2">No saved salons yet!</h3>
          <p className="text-text-secondary">Browse salons and tap the heart icon to save your favorites.</p>
          <button onClick={() => navigate('/home')} className="mt-4 bg-brand-purple hover:bg-[#9f7aea] text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-glow">
            Explore Salons
          </button>
        </div>
      )}

      {/* Salon Grid */}
      {!loading && savedSalons.length > 0 && (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-12">
          {savedSalons.map((salon, idx) => (
            <article key={salon.id} className="bg-card-dark rounded-2xl overflow-hidden shadow-2xl flex flex-col h-full border border-white/5 hover:-translate-y-1 hover:border-brand-purple/50 transition-all duration-300">
              {/* Image */}
              <div className="relative h-48 w-full shrink-0 group">
  <SalonThumbnail
    image={salon.logoUrl}
    fallbackImage={placeholderImages[idx % placeholderImages.length]}
    name={salon.salonName}
  />
                {/* Unsave Heart Button */}
                <button
                  onClick={() => handleUnsave(salon.id)}
                  className="absolute top-3 right-3 w-10 h-10 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-white/20 transition-all z-10 hover:scale-110 active:scale-90"
                  title="Remove from saved"
                >
                  <span className="material-symbols-outlined text-[#8b5cf6] [font-variation-settings:'FILL'_1]">favorite</span>
                </button>
              </div>

              {/* Info */}
              <div className="p-5 flex flex-col flex-grow">
                <h3 className="text-xl font-bold text-white mb-1 tracking-tight">{salon.salonName || 'Unnamed Salon'}</h3>
                <p className="text-sm text-text-secondary mb-4 flex-grow">{salon.aboutSalon?.slice(0, 80) || 'Beauty & grooming services.'}</p>

                <div className="flex items-center text-sm mb-6 bg-white/5 w-fit px-3 py-1.5 rounded-lg border border-white/5">
                  <span className="material-symbols-outlined text-yellow-400 text-base mr-1" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                  <span className="text-white font-bold">{salon.avgRating || 'New'}</span>
                  <span className="text-text-secondary ml-1.5">({salon.reviewCount || 0} review{salon.reviewCount !== 1 ? 's' : ''})</span>
                </div>

                <button
                  onClick={() => navigate(`/salon/${salon.id}`)}
                  className="mt-auto w-full bg-brand-purple hover:bg-[#8b5cf6] text-white font-semibold py-3 rounded-xl transition-all shadow-[0_4px_15px_rgba(107,70,193,0.3)] hover:shadow-[0_4px_20px_rgba(107,70,193,0.5)]"
                >
                  Book Now
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </CustomerLayout>
  );
};

export default SavedSalons;