import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from './firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import CustomerLayout from './CustomerLayout';

const SearchPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryParam = searchParams.get('q') || '';

  const [allResults, setAllResults] = useState([]);
  const [filteredResults, setFilteredResults] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [sortBy, setSortBy] = useState('best');
  const [selectedCategories, setSelectedCategories] = useState([]);

  const serviceCategories = ['Hair', 'Nails', 'Skincare', 'Body', 'Makeup'];
  const placeholderImages = ['/homepagesalon1.jpg', '/homepagesalon2.jpg', '/homepagesalon3.jpg', '/homepagesalon4.jpg', '/homepagesalon5.jpg', '/homepagesalon6.jpg'];

  // Fetch and text-filter salons based on query param
  useEffect(() => {
    const fetchAndFilter = async () => {
      setLoading(true);
      try {
        const salonQuery = query(collection(db, 'users'), where('role', '==', 'admin'), where('status', '==', 'approved'));
        const salonSnap = await getDocs(salonQuery);
        const salons = salonSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const reviewsSnap = await getDocs(collection(db, 'reviews'));
        const reviewsBySalon = {};
        reviewsSnap.docs.forEach(d => {
          const data = d.data();
          if (!reviewsBySalon[data.salonId]) reviewsBySalon[data.salonId] = [];
          reviewsBySalon[data.salonId].push(data.rating);
        });

        const servicesSnap = await getDocs(query(collection(db, 'services'), where('isActive', '==', true)));
        const servicesBySalon = {};
        servicesSnap.docs.forEach(d => {
          const data = d.data();
          if (!servicesBySalon[data.salonId]) servicesBySalon[data.salonId] = new Set();
          servicesBySalon[data.salonId].add(data.category);
        });

        const q = queryParam.toLowerCase();
        const enriched = salons.map(salon => {
          const ratings = reviewsBySalon[salon.id] || [];
          const avg = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length) : 0;
          const cats = servicesBySalon[salon.id] ? Array.from(servicesBySalon[salon.id]) : [];
          return { ...salon, avgRating: avg, reviewCount: ratings.length, serviceCategories: cats };
        });

        const textFiltered = q
          ? enriched.filter(s =>
              (s.salonName || '').toLowerCase().includes(q) ||
              (s.salonAddress || '').toLowerCase().includes(q) ||
              (s.aboutSalon || '').toLowerCase().includes(q) ||
              s.serviceCategories.some(cat => cat.toLowerCase().includes(q))
            )
          : enriched;

        setAllResults(textFiltered);
      } catch (err) {
        console.error('Error searching:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAndFilter();
  }, [queryParam]);

  // Apply sidebar filters + sort whenever they change
  useEffect(() => {
    let results = [...allResults];

    // Category filter
    if (selectedCategories.length > 0) {
      results = results.filter(s =>
        selectedCategories.some(cat => s.serviceCategories.includes(cat))
      );
    }

    // Sort
    if (sortBy === 'rating') {
      results.sort((a, b) => b.avgRating - a.avgRating);
    } else if (sortBy === 'reviews') {
      results.sort((a, b) => b.reviewCount - a.reviewCount);
    } else if (sortBy === 'name') {
      results.sort((a, b) => (a.salonName || '').localeCompare(b.salonName || ''));
    }

    setFilteredResults(results);
  }, [allResults, selectedCategories, sortBy]);

  const toggleCategory = (cat) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const clearFilters = () => {
    setSelectedCategories([]);
    setSortBy('best');
  };

  const hasActiveFilters = selectedCategories.length > 0 || sortBy !== 'best';

  return (
    <CustomerLayout activePage="">
      <div className="flex flex-col lg:flex-row gap-8">

        {/* --- FILTER SIDEBAR --- */}
        <aside className="w-full lg:w-64 shrink-0">
          <div className="lg:sticky lg:top-28 space-y-6 bg-[#1A1B26]/80 backdrop-blur-sm border border-border-color rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white tracking-tight">Filter & Sort</h2>

            {/* Sort By */}
            <div>
              <label className="text-text-secondary text-sm font-medium mb-2 block">Sort By</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                className="w-full bg-background-dark border border-border-color rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple appearance-none cursor-pointer">
                <option value="best">Best Match</option>
                <option value="rating">Highest Rated</option>
                <option value="reviews">Most Reviewed</option>
                <option value="name">Name (A-Z)</option>
              </select>
            </div>

            {/* Service Categories */}
            <div>
              <p className="text-text-secondary text-sm font-medium mb-3">Services Offered</p>
              <div className="space-y-2.5">
                {serviceCategories.map(cat => (
                  <label key={cat} className="flex items-center gap-3 cursor-pointer group">
                    <div onClick={() => toggleCategory(cat)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                        selectedCategories.includes(cat)
                          ? 'bg-brand-purple border-brand-purple'
                          : 'border-white/20 group-hover:border-brand-purple/50'
                      }`}>
                      {selectedCategories.includes(cat) && (
                        <span className="material-symbols-outlined text-white text-sm">check</span>
                      )}
                    </div>
                    <span className="text-white text-sm group-hover:text-brand-purple transition-colors">{cat}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Active filter count + clear */}
            {hasActiveFilters && (
              <div className="pt-2 border-t border-white/5">
                <button onClick={clearFilters}
                  className="w-full flex items-center justify-center gap-2 text-sm font-medium text-text-secondary hover:text-white border border-white/10 hover:border-white/30 py-2.5 rounded-xl transition-colors">
                  <span className="material-symbols-outlined text-base">filter_alt_off</span>
                  Clear All Filters
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* --- RESULTS --- */}
        <div className="flex-1 min-w-0">

          {/* Results Header */}
          <div className="flex flex-wrap justify-between items-baseline gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-white">
                {queryParam ? (
                  <>Salons for <span className="bg-gradient-to-r from-[#8b5cf6] to-[#6B46C1] text-transparent bg-clip-text">{queryParam}</span></>
                ) : 'All Salons'}
              </h1>
              <p className="text-text-secondary mt-1">
                {loading ? 'Searching...' : (
                  <>
                    {filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''} found
                    {selectedCategories.length > 0 && ` in ${selectedCategories.join(', ')}`}
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-10 h-10 border-4 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin"></div>
            </div>
          )}

          {/* No Results */}
          {!loading && filteredResults.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
              <span className="material-symbols-outlined text-6xl text-text-secondary/20">search_off</span>
              <h3 className="text-xl font-bold text-white">No salons found</h3>
              <p className="text-text-secondary max-w-sm">
                {hasActiveFilters
                  ? 'Try adjusting your filters or clearing them.'
                  : `No results for "${queryParam}". Try a different search term.`}
              </p>
              {hasActiveFilters ? (
                <button onClick={clearFilters} className="mt-2 bg-brand-purple hover:bg-[#8b5cf6] text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-glow">
                  Clear Filters
                </button>
              ) : (
                <button onClick={() => navigate('/home')} className="mt-2 bg-brand-purple hover:bg-[#8b5cf6] text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-glow">
                  Back to Home
                </button>
              )}
            </div>
          )}

          {/* Results Grid */}
          {!loading && filteredResults.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredResults.map((salon, idx) => (
                <div key={salon.id}
                  className="group flex flex-col bg-surface border border-border-color rounded-2xl overflow-hidden transition-all duration-300 hover:border-brand-purple/50 hover:shadow-[0_0_25px_rgba(107,70,193,0.15)] hover:-translate-y-1">

                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={salon.logoUrl || placeholderImages[idx % placeholderImages.length]}
                      alt={salon.salonName}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {salon.serviceCategories.length > 0 && (
                      <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                        {salon.serviceCategories.slice(0, 3).map(cat => (
                          <span key={cat} className="bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 rounded-full border border-white/10">
                            {cat}
                          </span>
                        ))}
                        {salon.serviceCategories.length > 3 && (
                          <span className="bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 rounded-full border border-white/10">
                            +{salon.serviceCategories.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="p-5 flex flex-col flex-grow">
                    <h3 className="text-lg font-bold text-white tracking-tight">{salon.salonName || 'Unnamed Salon'}</h3>
                    <div className="flex items-center gap-2 text-sm mt-1.5">
                      <span className="material-symbols-outlined text-yellow-400 text-base" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                      <span className="font-bold text-white">{salon.reviewCount > 0 ? salon.avgRating.toFixed(1) : 'New'}</span>
                      <span className="text-text-secondary">
                        {salon.reviewCount > 0 ? `(${salon.reviewCount} review${salon.reviewCount !== 1 ? 's' : ''})` : 'No reviews yet'}
                      </span>
                    </div>
                    {salon.salonAddress && (
                      <p className="text-sm text-text-secondary mt-2 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-base text-text-secondary/60">location_on</span>
                        {salon.salonAddress.length > 40 ? salon.salonAddress.slice(0, 40) + '...' : salon.salonAddress}
                      </p>
                    )}
                    <p className="text-sm text-text-secondary mt-2 flex-grow line-clamp-2">
                      {salon.aboutSalon?.slice(0, 100) || 'Beauty & grooming services.'}
                    </p>
                    <button onClick={() => navigate(`/salon/${salon.id}`)}
                      className="mt-4 w-full bg-brand-purple hover:bg-[#8b5cf6] text-white font-bold py-2.5 rounded-xl transition-all shadow-[0_4px_15px_rgba(107,70,193,0.2)] hover:shadow-[0_4px_20px_rgba(107,70,193,0.4)]">
                      View Salon
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </CustomerLayout>
  );
};

export default SearchPage;