import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBooking } from './BookingContext';
import { db } from './firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { formatLKR } from './utils/formatLKR';

const BookingStep1 = () => {
  const navigate = useNavigate();
  const { bookingData, toggleService } = useBooking();

  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch active services for the selected salon
  useEffect(() => {
    const fetchServices = async () => {
      if (!bookingData.salonId) { setLoading(false); return; }
      try {
        const q = query(collection(db, 'services'), where('salonId', '==', bookingData.salonId), where('isActive', '==', true));
        const snapshot = await getDocs(q);
        setServices(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('Error fetching services:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchServices();
  }, [bookingData.salonId]);

  // Group services by category
  const categories = services.reduce((acc, s) => {
    const cat = s.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  const fmtDur = (m) => {
    if (!m) return '';
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r > 0 ? `${h} hr ${r} min` : `${h} hr`;
  };

  return (
    <div className="min-h-screen bg-[#17141e] text-[#E2E8F0] font-sans futuristic-gradient-bg">
      <header className="flex items-center justify-between border-b border-[#2D3748] bg-[#211d29]/50 backdrop-blur-sm px-6 md:px-20 py-4 sticky top-0 z-50">
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate('/home')}>
          <img src="/logo.png" alt="BookMyLook" className="h-8 w-auto" />
          <h2 className="text-xl font-bold tracking-tight">BookMyLook</h2>
        </div>
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 group">
          <span className="text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">Cancel</span>
          <span className="material-symbols-outlined">close</span>
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-10">
        <div className="flex flex-col gap-8">
          {/* Progress Bar */}
          <div className="p-4 bg-[#211d29]/50 border border-[#2D3748] rounded-xl backdrop-blur-sm">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="text-[#6B46C1] font-bold">Service</span>
                <span className="material-symbols-outlined text-gray-500 text-base">chevron_right</span>
                <span className="text-gray-400">Time</span>
                <span className="material-symbols-outlined text-gray-500 text-base">chevron_right</span>
                <span className="text-gray-400">Details</span>
                <span className="material-symbols-outlined text-gray-500 text-base">chevron_right</span>
                <span className="text-gray-400">Confirm</span>
              </div>
              <p className="text-sm">Step 1 of 4</p>
            </div>
            <div className="h-2 bg-[#2D3748] rounded-full overflow-hidden">
              <div className="h-full bg-[#6B46C1] transition-all duration-500" style={{ width: '25%' }}></div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Service Selection */}
            <div className="lg:col-span-2 space-y-8">
              <div>
                <h1 className="text-4xl font-black text-gray-100 mb-2">Choose Your Services</h1>
                <p className="text-gray-400">Select one or more services you would like to book at <span className="text-white font-medium">{bookingData.salonName || 'this salon'}</span>.</p>
              </div>

              {loading && (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="w-10 h-10 border-4 border-[#6B46C1]/30 border-t-[#6B46C1] rounded-full animate-spin"></div>
                  <p className="text-gray-400 text-sm">Loading services...</p>
                </div>
              )}

              {!loading && services.length === 0 && (
                <div className="text-center py-16 text-gray-400">
                  <span className="material-symbols-outlined text-5xl text-gray-600 mb-2">content_cut</span>
                  <p>This salon hasn't added any services yet.</p>
                </div>
              )}

              {!loading && Object.entries(categories).map(([catName, catServices]) => (
                <div key={catName} className="space-y-4">
                  <h2 className="text-2xl font-bold border-l-2 border-[#6B46C1] px-4 text-gray-200">{catName}</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {catServices.map(s => {
                      const isSelected = bookingData.services.find(item => item.id === s.id);
                      return (
                        <div key={s.id} onClick={() => toggleService({ id: s.id, name: s.name, price: s.price, time: fmtDur(s.duration) })}
                          className={`flex justify-between items-center p-4 rounded-lg border transition-all cursor-pointer ${isSelected ? 'border-[#6B46C1] bg-[#6B46C1]/10' : 'border-[#2D3748] bg-[#211d29] hover:border-[#6B46C1]'}`}>
                          <div>
                            <p className="font-bold text-gray-200">{s.name}</p>
                            <p className="text-sm text-gray-400">{fmtDur(s.duration)}</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <p className="font-semibold text-gray-300">{formatLKR(s.price)}</p>
                            <button className={`size-8 rounded-full border-2 border-[#6B46C1] flex items-center justify-center ${isSelected ? 'bg-[#6B46C1] text-white' : 'text-[#6B46C1]'}`}>
                              <span className="material-symbols-outlined text-xl">{isSelected ? 'check' : 'add'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Sticky Sidebar Basket */}
            <div className="lg:col-span-1">
              <div className="sticky top-28 bg-[#211d29]/50 backdrop-blur-sm border border-[#2D3748] rounded-xl p-6 flex flex-col gap-6">
                <h3 className="text-xl font-bold">Your Basket</h3>
                <div className="flex flex-col gap-4 border-b border-[#2D3748] pb-4">
                  {bookingData.services.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <span className="material-symbols-outlined text-5xl text-[#6B46C1] mb-2">shopping_basket</span>
                      <p>Your basket is empty.</p>
                    </div>
                  ) : (
                    bookingData.services.map(item => (
                      <div key={item.id} className="flex justify-between items-start text-sm">
                        <span>{item.name}</span>
                        <span className="font-medium text-gray-300">{formatLKR(item.price)}</span>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex justify-between font-bold text-lg text-gray-100">
                  <span>Total Cost</span>
                  <span>{formatLKR(bookingData.totalCost)}</span>
                </div>
                <button disabled={bookingData.services.length === 0} onClick={() => navigate('/book-step2')}
                  className="w-full bg-[#6B46C1] h-12 rounded-lg font-bold hover:bg-purple-500 disabled:opacity-50 transition-all shadow-lg shadow-[#6B46C1]/20">
                  Select Time
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default BookingStep1;