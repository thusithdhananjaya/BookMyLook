// src/BookingStep3.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBooking } from './BookingContext';
import { LOYALTY_REDEEM_COST, LOYALTY_DISCOUNT_LKR } from './BookingContext';
import { useAuth } from './AuthContext';
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { formatLKR } from './utils/formatLKR';

const BookingStep3 = () => {
  const navigate = useNavigate();
  const { bookingData, updateUserDetails, toggleLoyaltyPoints } = useBooking();
  const { currentUser } = useAuth();

  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [pointsLoading, setPointsLoading] = useState(true);

  const finalCost = bookingData.totalCost - bookingData.discount;

  // Fetch real loyalty points balance
  useEffect(() => {
    const fetchPoints = async () => {
      if (!currentUser) { setPointsLoading(false); return; }
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setLoyaltyPoints(userDoc.data().loyaltyPoints || 0);
        }
      } catch (err) {
        console.error('Error fetching loyalty points:', err);
      } finally {
        setPointsLoading(false);
      }
    };
    fetchPoints();
  }, [currentUser]);

  const canRedeem = loyaltyPoints >= LOYALTY_REDEEM_COST;

  return (
    <div className="min-h-screen bg-[#17141e] text-[#E2E8F0] font-sans futuristic-gradient-bg">
      {/* Header */}
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
          
          {/* Progress Bar (75%) */}
          <div className="p-4 bg-[#211d29]/50 border border-[#2D3748] rounded-xl backdrop-blur-sm">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="text-[#6B46C1] font-bold">Service</span>
                <span className="material-symbols-outlined text-[#6B46C1] text-base">check</span>
                <span className="text-[#6B46C1] font-bold">Time</span>
                <span className="material-symbols-outlined text-[#6B46C1] text-base">check</span>
                <span className="text-[#6B46C1] font-bold">Details</span>
                <span className="material-symbols-outlined text-gray-500 text-base">chevron_right</span>
                <span className="text-gray-400">Confirm</span>
              </div>
              <p className="text-sm">Step 3 of 4</p>
            </div>
            <div className="h-2 bg-[#2D3748] rounded-full overflow-hidden">
              <div className="h-full bg-[#6B46C1] transition-all duration-500" style={{ width: '75%' }}></div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <div>
                <h1 className="text-4xl font-black text-gray-100 mb-2">Your Details</h1>
                <p className="text-gray-400">Tell us a bit about yourself so we can confirm your booking.</p>
              </div>

              {/* Contact Details Form */}
              <div className="p-6 bg-[#211d29]/50 border border-[#2D3748] rounded-xl flex flex-col gap-5 backdrop-blur-sm">
                <h2 className="text-lg font-bold text-gray-100">Contact Information</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-400">Full Name</label>
                    <input value={bookingData.userDetails.fullName} onChange={(e) => updateUserDetails('fullName', e.target.value)}
                      className="w-full bg-[#17141e] border border-[#2D3748] rounded-lg p-3 outline-none focus:border-[#6B46C1] focus:ring-1 focus:ring-[#6B46C1]" placeholder="Enter your full name" type="text"/>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-400">Email Address</label>
                    <input value={bookingData.userDetails.email} onChange={(e) => updateUserDetails('email', e.target.value)}
                      className="w-full bg-[#17141e] border border-[#2D3748] rounded-lg p-3 outline-none focus:border-[#6B46C1] focus:ring-1 focus:ring-[#6B46C1]" placeholder="your@email.com" type="email"/>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-400">Phone Number</label>
                  <input value={bookingData.userDetails.phone} onChange={(e) => updateUserDetails('phone', e.target.value)}
                    className="w-full bg-[#17141e] border border-[#2D3748] rounded-lg p-3 outline-none focus:border-[#6B46C1] focus:ring-1 focus:ring-[#6B46C1]" placeholder="+94 7X XXX XXXX" type="tel"/>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-400">Special Requests (Optional)</label>
                  <textarea value={bookingData.userDetails.specialRequest} onChange={(e) => updateUserDetails('specialRequest', e.target.value)}
                    className="w-full bg-[#17141e] border border-[#2D3748] rounded-lg p-3 outline-none focus:border-[#6B46C1] focus:ring-1 focus:ring-[#6B46C1]" placeholder="Any allergies, preferences, or notes for your stylist?"></textarea>
                </div>
              </div>

              {/* Loyalty Points Section */}
              <div className={`p-6 bg-[#211d29]/50 rounded-xl border transition-all ${bookingData.usePoints ? 'border-[#FFD700] shadow-[0_0_15px_rgba(255,215,0,0.2)]' : 'border-[#2D3748]'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-[#FFD700]">Redeem Loyalty Points</h3>
                    {pointsLoading ? (
                      <p className="text-sm text-gray-300">Loading points...</p>
                    ) : (
                      <p className="text-sm text-gray-300">
                        You have <span className="font-bold text-white">{loyaltyPoints.toLocaleString()}</span> points available.
                        {!canRedeem && <span className="text-yellow-500/70 ml-1">(Need {LOYALTY_REDEEM_COST} to redeem)</span>}
                      </p>
                    )}
                  </div>
                  <label className={`relative inline-flex items-center ${canRedeem ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
                    <input type="checkbox" className="sr-only peer" checked={bookingData.usePoints} onChange={canRedeem ? toggleLoyaltyPoints : undefined} disabled={!canRedeem} />
                    <div className="w-11 h-6 bg-[#2D3748] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFD700]"></div>
                  </label>
                </div>
                <p className="text-sm text-yellow-300/80 mt-2">
                  {canRedeem 
                    ? `Toggle to use ${LOYALTY_REDEEM_COST} points and get ${formatLKR(LOYALTY_DISCOUNT_LKR)} off your total.`
                    : `Earn more points by completing bookings. You need ${LOYALTY_REDEEM_COST - loyaltyPoints} more points to unlock a ${formatLKR(LOYALTY_DISCOUNT_LKR)} discount.`
                  }
                </p>
              </div>
            </div>

            {/* Dynamic Sidebar Basket */}
            <div className="lg:col-span-1">
              <div className="sticky top-28 bg-[#211d29]/50 border border-[#2D3748] rounded-xl p-6 flex flex-col gap-6">
                <h3 className="text-xl font-bold">Your Basket</h3>
                <div className="flex flex-col gap-4 border-b border-[#2D3748] pb-4">
                  {bookingData.services.map(item => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <div><p className="font-semibold">{item.name}</p></div>
                      <span className="font-medium">{formatLKR(item.price)}</span>
                    </div>
                  ))}
                  
                  {/* Selected Date/Time Summary */}
                  <div className="flex flex-col gap-2 mt-4 text-sm text-gray-400 bg-[#17141e] p-3 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">calendar_month</span> Date:</span>
                      <span className="text-white">{bookingData.month.slice(0,3)} {bookingData.date}, {bookingData.year}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">schedule</span> Time:</span>
                      <span className="text-white">{bookingData.time}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">person</span> Stylist:</span>
                      <span className="text-white truncate max-w-[120px] text-right">{bookingData.stylist}</span>
                    </div>
                  </div>
                </div>

                {/* Totals */}
                <div className="flex flex-col gap-2 text-sm text-gray-300">
                  <div className="flex justify-between"><span>Subtotal</span><span className="font-semibold">{formatLKR(bookingData.totalCost)}</span></div>
                  {bookingData.usePoints && (
                    <div className="flex justify-between text-[#FFD700]"><span>Loyalty Points Discount</span><span className="font-semibold">-{formatLKR(bookingData.discount)}</span></div>
                  )}
                  <div className="flex justify-between font-bold text-lg text-white pt-3 border-t border-[#2D3748] mt-2">
                    <span>Total Cost</span><span>{formatLKR(finalCost)}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <button 
                    disabled={!bookingData.userDetails.fullName?.trim() || !bookingData.userDetails.email?.trim() || !bookingData.userDetails.phone?.trim()}
                    onClick={() => navigate('/book-step4')}
                    className={`w-full h-12 rounded-lg font-bold transition-all ${
                      bookingData.userDetails.fullName?.trim() && bookingData.userDetails.email?.trim() && bookingData.userDetails.phone?.trim()
                        ? 'bg-[#6B46C1] text-white hover:bg-purple-500 shadow-lg shadow-[#6B46C1]/20'
                        : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    }`}>
                    Review & Confirm
                  </button>
                  {(!bookingData.userDetails.fullName?.trim() || !bookingData.userDetails.email?.trim() || !bookingData.userDetails.phone?.trim()) && (
                    <p className="text-xs text-yellow-400/70 text-center">Please fill in your name, email, and phone to continue.</p>
                  )}
                  <button onClick={() => navigate(-1)} className="w-full border border-[#2D3748] h-12 rounded-lg text-gray-300 hover:bg-[#2D3748] transition-colors">
                    Back
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default BookingStep3;