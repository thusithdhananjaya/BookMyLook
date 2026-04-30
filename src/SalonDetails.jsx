import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBooking } from './BookingContext';
import { useAuth } from './AuthContext';
import { db } from './firebase';
import { doc, getDoc, setDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { formatLKR } from './utils/formatLKR';

const SalonDetails = () => {
  const navigate = useNavigate();
  const { salonId } = useParams();
  const { currentUser } = useAuth();
  const { setSalon } = useBooking();
  const [activeTab, setActiveTab] = useState('About');
  const [galleryFilter, setGalleryFilter] = useState('All');
  const [selectedService, setSelectedService] = useState(null);

  // Dynamic data from Firestore
  const [salonData, setSalonData] = useState(null);
  const [servicesList, setServicesList] = useState([]);
  const [lookbookPhotos, setLookbookPhotos] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  // Check if this salon is saved by the current user
  useEffect(() => {
    const checkSaved = async () => {
      if (!currentUser || !salonId) return;
      try {
        const savedDoc = await getDoc(doc(db, 'users', currentUser.uid, 'savedSalons', salonId));
        setIsSaved(savedDoc.exists());
      } catch (err) {
        console.error('Error checking saved status:', err);
      }
    };
    checkSaved();
  }, [currentUser, salonId]);

  // Toggle save/unsave
  const handleToggleSave = async () => {
    if (!currentUser) return;
    try {
      const savedRef = doc(db, 'users', currentUser.uid, 'savedSalons', salonId);
      if (isSaved) {
        await deleteDoc(savedRef);
        setIsSaved(false);
      } else {
        await setDoc(savedRef, { savedAt: new Date() });
        setIsSaved(true);
      }
    } catch (err) {
      console.error('Error toggling save:', err);
    }
  };

  // Fetch salon info, services, and lookbook
  useEffect(() => {
    const fetchSalonData = async () => {
      try {
        // Fetch salon profile from users collection
        const salonDoc = await getDoc(doc(db, 'users', salonId));
        if (salonDoc.exists()) {
          setSalonData({ id: salonDoc.id, ...salonDoc.data() });
        }

        // Fetch active services for this salon
        const servicesQuery = query(collection(db, 'services'), where('salonId', '==', salonId), where('isActive', '==', true));
        const servicesSnap = await getDocs(servicesQuery);
        setServicesList(servicesSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // Fetch lookbook photos for this salon
        const lookbookQuery = query(collection(db, 'lookbook'), where('salonId', '==', salonId));
        const lookbookSnap = await getDocs(lookbookQuery);
        setLookbookPhotos(lookbookSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // Fetch reviews for this salon
        const reviewsQuery = query(collection(db, 'reviews'), where('salonId', '==', salonId));
        const reviewsSnap = await getDocs(reviewsQuery);
        setReviews(reviewsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // Fetch staff members for this salon
        const staffQuery = query(collection(db, 'staff'), where('salonId', '==', salonId));
        const staffSnap = await getDocs(staffQuery);
        setStaffMembers(staffSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('Error fetching salon data:', err);
      } finally {
        setLoading(false);
      }
    };
    if (salonId) fetchSalonData();
  }, [salonId]);

  const handleBookNow = () => {
    setSalon(salonId, salonData?.salonName || 'Unknown Salon');
    navigate('/book-appointment');
  };

  const fmtDur = (m) => {
    if (!m) return '';
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r > 0 ? `${h} hr ${r} min` : `${h} hr`;
  };

  // Computed rating from real reviews
  const averageRating = reviews.length > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : '0.0';
  const reviewCount = reviews.length;

  // Gallery filter uses Firestore lookbook data
  const galleryCategories = ['All', ...new Set(lookbookPhotos.map(p => p.category).filter(Boolean))];
  const filteredGallery = galleryFilter === 'All' ? lookbookPhotos : lookbookPhotos.filter(item => item.category === galleryFilter);

  const renderStars = (rating) => (
    <div className="flex items-center gap-0.5">
      {[...Array(5)].map((_, i) => (
        <svg key={i} className={`w-5 h-5 ${i < Math.floor(rating) ? 'text-[#FFD700]' : 'text-gray-600'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
        </svg>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#121019] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#6B46C1]/30 border-t-[#6B46C1] rounded-full animate-spin"></div>
      </div>
    );
  }

  const salonName = salonData?.salonName || 'Unknown Salon';
  const salonAddress = salonData?.salonAddress || 'Address not provided';
  const aboutSalon = salonData?.aboutSalon || '';

  return (
    <div className="min-h-screen bg-[#121019] text-[#F7FAFC] font-sans selection:bg-[#6B46C1] selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-[#2D3748] px-6 py-4 bg-[#121019]/95 backdrop-blur-md">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/home')}>
          <img src="/logo.png" alt="BookMyLook" className="h-8 w-auto" />
          <h2 className="text-lg font-bold leading-tight tracking-[-0.015em]">BookMyLook</h2>
        </div>
        <div className="flex items-center gap-4">
          <button className="relative p-2 text-gray-400 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-[#121019]"></span>
          </button>
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-transparent hover:border-[#6B46C1] transition-all cursor-pointer">
            <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=80" alt="Profile" className="w-full h-full object-cover" />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full">
        {/* Back button + Save button */}
        <div className="flex items-center justify-between px-4 md:px-6 py-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="flex items-center justify-center p-2 rounded-full hover:bg-gray-800 text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            </button>
            <h2 className="text-lg font-bold hidden md:block text-gray-200">Salon Details</h2>
          </div>
          <button
            onClick={handleToggleSave}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold transition-all ${
              isSaved
                ? 'bg-[#8b5cf6]/20 border-[#8b5cf6]/50 text-[#8b5cf6]'
                : 'bg-white/5 border-white/20 text-white hover:border-[#8b5cf6]/50 hover:text-[#8b5cf6]'
            }`}
          >
            <span className="material-symbols-outlined text-lg" style={isSaved ? { fontVariationSettings: "'FILL' 1" } : {}}>favorite</span>
            {isSaved ? 'Saved' : 'Save Salon'}
          </button>
        </div>

        {/* Hero Images */}
        <section className="px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 h-80">
            <div className="col-span-2 row-span-2 rounded-2xl overflow-hidden cursor-pointer group"><img src="/homepagesalon1.jpg" alt="Main" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/></div>
            <div className="rounded-2xl overflow-hidden cursor-pointer group"><img src="/salondetail1.jpg" alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/></div>
            <div className="rounded-2xl overflow-hidden cursor-pointer group"><img src="/salondetail4.jpg" alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/></div>
            <div className="rounded-2xl overflow-hidden cursor-pointer group"><img src="/salondetail3.jpg" alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/></div>
            <div className="rounded-2xl overflow-hidden cursor-pointer group"><img src="/salondetail2.jpg" alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/></div>
          </div>
        </section>

        {/* Title & Book Now */}
        <section className="flex flex-wrap justify-between items-start gap-4 p-4 md:p-6 mt-2">
          <div className="flex flex-col gap-2">
            <h1 className="text-white text-4xl font-black leading-tight tracking-tight">{salonName}</h1>
            <div className="flex items-center gap-2 text-[#A0AEC0] text-base">
              <div className="flex items-center gap-1 bg-[#FFD700]/10 px-2 py-0.5 rounded-md border border-[#FFD700]/20">
                <svg className="w-4 h-4 text-[#FFD700]" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                <span className="font-bold text-white">{averageRating}</span>
                <span className="text-xs ml-1">({reviewCount} review{reviewCount !== 1 ? 's' : ''})</span>
              </div>
              <span>•</span>
              <span>{salonAddress}</span>
            </div>
          </div>
          <div className="w-full md:w-auto mt-4 md:mt-0">
            <button onClick={handleBookNow} className="w-full md:w-auto flex items-center justify-center rounded-xl h-14 px-8 bg-[#6B46C1] hover:bg-[#553C9A] text-white text-lg font-bold tracking-wide transition-all">Book Now</button>
          </div>
        </section>

        {/* Tab Navigation */}
        <nav className="sticky top-[73px] z-40 bg-[#121019]/95 backdrop-blur-sm border-b border-[#2D3748]">
          <div className="flex px-4 md:px-6 gap-8 overflow-x-auto">
            {['About', 'Services', 'Staff', 'Reviews', 'Gallery'].map((item) => (
              <button key={item} onClick={() => setActiveTab(item)}
                className={`pb-4 pt-4 text-sm font-bold tracking-wide border-b-2 transition-colors ${activeTab === item ? 'border-[#6B46C1] text-white' : 'border-transparent text-[#A0AEC0] hover:text-white hover:border-gray-500'}`}>
                {item}
              </button>
            ))}
          </div>
        </nav>

        {/* Dynamic Content Area */}
        <div className="p-4 md:p-6 pb-24 animate-[fadeIn_0.3s_ease-out]">
          
          {/* ABOUT */}
          {activeTab === 'About' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="space-y-4 text-[#A0AEC0] leading-relaxed">
                  {aboutSalon ? <p>{aboutSalon}</p> : (
                    <>
                      <p>Welcome to <strong>{salonName}</strong>, a premier destination for luxury and rejuvenation. We are more than just a salon; we are a sanctuary designed to whisk you away from the daily hustle.</p>
                      <p>Our team of master stylists and expert estheticians are true artists, continuously trained in the latest global trends. We take the time to listen, ensuring every treatment is perfectly suited to your lifestyle.</p>
                    </>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                <div className="relative bg-[#1A1821]/50 p-5 rounded-xl border border-[#6B46C1]/30 shadow-[0_0_15px_rgba(107,70,193,0.1)] overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#6B46C1]/10 to-transparent"></div>
                  <h4 className="font-bold text-lg mb-4 text-white flex items-center gap-2"><svg className="w-5 h-5 text-[#6B46C1]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>Opening Hours</h4>
                  <ul className="space-y-3 text-sm text-[#A0AEC0] relative z-10">
                    <li className="flex justify-between border-b border-gray-800 pb-2"><span>Mon - Fri</span><span className="font-medium text-white">{salonData?.operatingHours?.monFriOpen || salonData?.operatingHours?.open || '09:00'} - {salonData?.operatingHours?.monFriClose || salonData?.operatingHours?.close || '18:00'}</span></li>
                    <li className="flex justify-between border-b border-gray-800 pb-2"><span>Saturday</span><span className="font-medium text-white">{salonData?.operatingHours?.satOpen || '09:00'} - {salonData?.operatingHours?.satClose || '17:00'}</span></li>
                    <li className="flex justify-between"><span>Sunday</span><span className={`font-medium ${salonData?.operatingHours?.sunClosed === false ? 'text-white' : 'text-red-400'}`}>{salonData?.operatingHours?.sunClosed === false ? `${salonData.operatingHours.sunOpen || '10:00'} - ${salonData.operatingHours.sunClose || '14:00'}` : 'Closed'}</span></li>
                  </ul>
                </div>
                <div className="relative bg-[#1A1821]/50 p-5 rounded-xl border border-[#6B46C1]/30 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#6B46C1]/10 to-transparent"></div>
                  <h4 className="font-bold text-lg mb-2 text-white flex items-center gap-2"><svg className="w-5 h-5 text-[#6B46C1]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>Address</h4>
                  <p className="text-sm text-[#A0AEC0] relative z-10">{salonAddress}</p>
                </div>
                <div className="relative bg-[#1A1821]/50 p-5 rounded-xl border border-[#6B46C1]/30 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#6B46C1]/10 to-transparent"></div>
                  <h4 className="font-bold text-lg mb-2 text-white flex items-center gap-2"><svg className="w-5 h-5 text-[#6B46C1]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>Contact</h4>
                  <p className="text-sm text-[#A0AEC0] relative z-10">{salonData?.contactPhone || 'Not provided'}</p>
                </div>
              </div>
            </div>
          )}

          {/* SERVICES — now dynamic from Firestore */}
          {activeTab === 'Services' && (
            <div>
              <h3 className="text-2xl font-bold mb-6 text-white">Available Services</h3>
              {servicesList.length === 0 ? (
                <p className="text-[#A0AEC0] text-center py-10">This salon hasn't added any services yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {servicesList.map((service, idx) => (
                    <div key={service.id} onClick={() => setSelectedService(idx)}
                      className={`relative p-4 rounded-xl border flex flex-col justify-between cursor-pointer transition-all duration-200 ${selectedService === idx ? 'bg-[#6B46C1]/20 border-[#6B46C1] ring-1 ring-[#6B46C1]/50' : 'bg-black/20 border-[#2D3748] hover:border-[#6B46C1]/50 hover:bg-[#6B46C1]/10'}`}>
                      <div>
                        <h4 className="font-bold text-lg text-white">{service.name}</h4>
                        {service.description && <p className="text-sm text-[#A0AEC0] mt-1 line-clamp-2">{service.description}</p>}
                      </div>
                      <div className="flex items-center gap-4 text-sm mt-4 text-[#A0AEC0]">
                        <span className="flex items-center gap-1.5">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                          {fmtDur(service.duration)}
                        </span>
                        <span className="font-bold text-white text-base">{formatLKR(service.price)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STAFF */}
          {activeTab === 'Staff' && (
            <div><h3 className="text-2xl font-bold mb-6 text-white">Meet Our Team</h3>
              {staffMembers.length === 0 ? (
                <p className="text-[#A0AEC0] text-center py-10">This salon hasn't added any team members yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {staffMembers.map((member) => (
                    <div key={member.id} className="flex flex-col items-center text-center p-6 bg-black/20 rounded-xl border border-[#2D3748] hover:border-[#6B46C1]/50 transition-colors duration-200">
                      {member.photoUrl ? (
                        <img src={member.photoUrl} alt={member.name} className="w-32 h-32 rounded-full object-cover border-4 border-[#6B46C1]/50 mb-4"/>
                      ) : (
                        <div className="w-32 h-32 rounded-full border-4 border-[#6B46C1]/50 mb-4 bg-white/10 flex items-center justify-center">
                          <span className="material-symbols-outlined text-5xl text-[#A0AEC0]">person</span>
                        </div>
                      )}
                      <h4 className="font-bold text-lg text-white">{member.name}</h4>
                      <p className="text-sm text-[#6B46C1] font-medium mt-1">{member.role}</p>
                      {member.description && <p className="text-sm text-[#A0AEC0] mt-3">{member.description}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* REVIEWS */}
          {activeTab === 'Reviews' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                  <h3 className="text-2xl font-bold text-white">Overall Rating</h3>
                  {reviewCount > 0 ? (
                    <>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex text-[#FFD700]">
                          {[...Array(5)].map((_, i) => (
                            <svg key={i} className={`w-6 h-6 ${i < Math.round(Number(averageRating)) ? 'text-[#FFD700]' : 'text-gray-600'}`} fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                            </svg>
                          ))}
                        </div>
                        <p className="text-xl font-bold text-white">{averageRating} <span className="text-base font-normal text-[#A0AEC0]">out of 5</span></p>
                      </div>
                      <p className="text-sm text-[#A0AEC0] mt-1">Based on {reviewCount} review{reviewCount !== 1 ? 's' : ''}</p>
                    </>
                  ) : (
                    <p className="text-sm text-[#A0AEC0] mt-2">No reviews yet. Be the first to review this salon!</p>
                  )}
                </div>
              </div>

              {reviews.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                  <span className="material-symbols-outlined text-6xl text-[#A0AEC0]/30">rate_review</span>
                  <p className="text-[#A0AEC0]">No reviews yet for this salon.</p>
                </div>
              ) : (
                reviews.map((review) => (
                  <div key={review.id} className="p-6 bg-black/20 rounded-xl border border-[#2D3748]">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold text-lg text-white">{review.customerName}</h4>
                        <p className="text-xs text-[#A0AEC0] mt-1">
                          {review.createdAt?.toDate ? review.createdAt.toDate().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Recently'}
                        </p>
                      </div>
                      {renderStars(review.rating)}
                    </div>
                    <p className="text-sm text-[#A0AEC0] leading-relaxed">"{review.text}"</p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* GALLERY */}
          {activeTab === 'Gallery' && (
            <div>
              <div className="flex flex-col sm:flex-row gap-4 items-center mb-8">
                <h3 className="text-2xl font-bold text-white">Visual Showcase</h3>
                <div className="flex-grow flex flex-wrap gap-2 justify-start">
                  {galleryCategories.map(filter => (
                    <button key={filter} onClick={() => setGalleryFilter(filter)}
                      className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors border ${galleryFilter === filter ? 'bg-[#6B46C1]/20 text-white border-[#6B46C1]' : 'bg-black/20 text-[#A0AEC0] border-[#2D3748] hover:bg-[#2D3748] hover:text-white'}`}>
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              {lookbookPhotos.length === 0 ? (
                <p className="text-[#A0AEC0] text-center py-10">This salon hasn't uploaded any portfolio photos yet.</p>
              ) : filteredGallery.length === 0 ? (
                <p className="text-[#A0AEC0] text-center py-10">No photos found in "{galleryFilter}" category.</p>
              ) : (
                <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
                  {filteredGallery.map((item) => (
                    <div key={item.id} className="break-inside-avoid relative group overflow-hidden rounded-lg cursor-pointer">
                      <img src={item.imageUrl} alt={item.title} className="w-full object-cover transition-transform duration-500 group-hover:scale-110"/>
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                        <p className="text-white text-sm font-bold mb-2">{item.title}</p>
                        <button onClick={handleBookNow} className="self-start flex items-center gap-2 text-xs font-bold bg-[#FFD700] text-black px-3 py-1.5 rounded-full hover:bg-yellow-200 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
                          Book This Look
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* AI FAB */}
      <div className="fixed bottom-6 right-6 z-50">
        <button className="flex items-center justify-center w-14 h-14 rounded-full bg-[#6B46C1] text-white shadow-[0_0_20px_rgba(107,70,193,0.4)] hover:bg-[#553C9A] hover:scale-110 transition-all duration-300">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
        </button>
      </div>
    </div>
  );
};

export default SalonDetails;