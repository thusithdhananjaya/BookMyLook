// src/BookingStep4.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBooking } from './BookingContext';
import { useAuth } from './AuthContext';
import { db } from './firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { formatLKR } from './utils/formatLKR';

const BookingStep4 = () => {
  const navigate = useNavigate();
  const { bookingData, resetBooking } = useBooking();
  const { currentUser } = useAuth();
  
  // State for the form validation
  const [paymentMethod, setPaymentMethod] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Demo payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentStep, setPaymentStep] = useState('form'); // 'form' | 'processing' | 'success'
  const [cardNumber, setCardNumber] = useState('4242 4242 4242 4242');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvv, setCardCvv] = useState('123');
  const [cardName, setCardName] = useState('');

  const finalCost = bookingData.totalCost - bookingData.discount;

  // Wrapper: if online payment, show demo gateway first
  const handleConfirmClick = () => {
    if (paymentMethod === 'online') {
      setCardName(bookingData.userDetails?.fullName || currentUser?.displayName || '');
      setPaymentStep('form');
      setShowPaymentModal(true);
    } else {
      handleConfirmBooking();
    }
  };

  // Simulate online payment processing
  const handlePayNow = () => {
    setPaymentStep('processing');
    setTimeout(() => {
      setPaymentStep('success');
      setTimeout(() => {
        setShowPaymentModal(false);
        handleConfirmBooking();
      }, 1500);
    }, 2000);
  };

  const handleConfirmBooking = async () => {
    // Guard: prevent double-submit
    if (isSubmitting) return;
    setSubmitError('');
    setIsSubmitting(true);

    try {
      // Build the booking document
      const bookingDoc = {
        // Who booked
        customerId: currentUser.uid,
        customerName: bookingData.userDetails.fullName || currentUser.displayName || 'Unknown',
        customerEmail: bookingData.userDetails.email || currentUser.email || '',
        customerPhone: bookingData.userDetails.phone || '',

        // Which salon
        salonId: bookingData.salonId,
        salonName: bookingData.salonName,

        // Services
        services: bookingData.services.map(s => ({
          id: s.id,
          name: s.name,
          price: s.price,
          duration: s.time || s.duration || ''
        })),

        // Schedule
        date: bookingData.date,
        month: bookingData.month,
        year: bookingData.year,
        time: bookingData.time,
        stylist: bookingData.stylist,

        // Cost
        totalCost: bookingData.totalCost,
        discount: bookingData.discount,
        finalCost: finalCost,
        usedLoyaltyPoints: bookingData.usePoints,

        // Payment & status
        paymentMethod: paymentMethod,
        status: 'pending',
        specialRequest: bookingData.userDetails.specialRequest || '',

        // Metadata
        createdAt: serverTimestamp(),
        noShowRisk: null  // Placeholder — Phase 6 fills this via AI
      };

      // Write to Firestore and get the document ID
      const docRef = await addDoc(collection(db, 'bookings'), bookingDoc);

      // --- AI NO-SHOW PREDICTION ---
      // This runs in the background — booking is already saved regardless of AI result
      try {
        // Count customer's previous no-shows
        const noShowQuery = query(
          collection(db, 'bookings'),
          where('customerId', '==', currentUser.uid),
          where('status', '==', 'no_show')
        );
        const noShowSnap = await getDocs(noShowQuery);
        const previousNoShows = noShowSnap.size;

        // Parse hour from time string (e.g., "10:30 AM" → 10)
        const timeParts = bookingData.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
        let hourOfDay = 10; // default
        if (timeParts) {
          hourOfDay = parseInt(timeParts[1]);
          if (timeParts[3].toUpperCase() === 'PM' && hourOfDay !== 12) hourOfDay += 12;
          if (timeParts[3].toUpperCase() === 'AM' && hourOfDay === 12) hourOfDay = 0;
        }

        // Calculate day of week from booking date
        const monthIndex = ['January','February','March','April','May','June','July','August','September','October','November','December'].indexOf(bookingData.month);
        const appointmentDate = new Date(bookingData.year, monthIndex, bookingData.date);
        const dayOfWeek = appointmentDate.getDay(); // 0=Sun in JS, need 0=Mon
        const dayOfWeekMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert: Sun=6, Mon=0

        // Calculate lead time (days between now and appointment)
        const today = new Date();
        const leadTimeDays = Math.max(0, Math.round((appointmentDate - today) / (1000 * 60 * 60 * 24)));

        // Get primary service category
        const category = bookingData.services[0]?.category || bookingData.services[0]?.name?.includes('Hair') ? 'Hair' : 'Other';

        // Call the FastAPI prediction endpoint
        const predictionRes = await fetch('http://localhost:8000/predict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            day_of_week: dayOfWeekMon,
            hour_of_day: hourOfDay,
            category: category,
            lead_time_days: leadTimeDays,
            payment_online: paymentMethod === 'online' ? 1 : 0,
            used_loyalty: bookingData.usePoints ? 1 : 0,
            previous_no_shows: previousNoShows
          })
        });

        if (predictionRes.ok) {
          const prediction = await predictionRes.json();
          // Update the booking document with the AI risk score
          await updateDoc(doc(db, 'bookings', docRef.id), {
            noShowRisk: prediction.risk_score,
            noShowRiskLevel: prediction.risk_level,
            noShowFactors: prediction.factors || []
          });
        }
      } catch (aiErr) {
        // AI service unavailable — booking still works, risk stays null
        console.warn('AI prediction unavailable (service may not be running):', aiErr.message);
      }

      // Build recap data BEFORE resetting context
      const recapData = {
        salonName: bookingData.salonName,
        date: bookingData.date,
        month: bookingData.month,
        year: bookingData.year,
        time: bookingData.time,
        services: bookingData.services.map(s => s.name),
        stylist: bookingData.stylist,
        paymentMethod: paymentMethod,
        userEmail: bookingData.userDetails.email || currentUser.email || ''
      };

      // Clear context so stale data doesn't linger
      resetBooking();

      // Navigate to success page with all recap data in router state
      navigate('/booking-success', { state: recapData });
      
    } catch (err) {
      console.error('Failed to save booking:', err);
      setSubmitError('Something went wrong while saving your booking. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  

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
          
          {/* Progress Bar (100%) */}
          <div className="p-4 bg-[#211d29]/50 border border-[#2D3748] rounded-xl backdrop-blur-sm">
             <div className="flex justify-between items-center mb-4 overflow-x-auto whitespace-nowrap hide-scrollbar">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="text-[#6B46C1] font-bold">Service</span>
                <span className="material-symbols-outlined text-[#6B46C1] text-base">check</span>
                <span className="text-[#6B46C1] font-bold">Time</span>
                <span className="material-symbols-outlined text-[#6B46C1] text-base">check</span>
                <span className="text-[#6B46C1] font-bold">Details</span>
                <span className="material-symbols-outlined text-[#6B46C1] text-base">check</span>
                <span className="text-[#6B46C1] font-bold">Confirm</span>
              </div>
              <p className="text-sm pl-4">Step 4 of 4</p>
            </div>
            <div className="h-2 bg-[#2D3748] rounded-full overflow-hidden">
              <div className="h-full bg-[#6B46C1] shadow-primary-glow-subtle transition-all duration-500" style={{ width: '100%' }}></div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <div>
                <h1 className="text-4xl font-black text-gray-100 mb-2">Review & Complete Your Booking</h1>
                <p className="text-gray-400">Review your booking details and choose your payment method to complete.</p>
              </div>

              {/* Booking Summary Box */}
              <div className="p-6 bg-[#211d29]/50 border border-[#2D3748] rounded-xl flex flex-col gap-6 backdrop-blur-sm">
                <h2 className="text-lg font-bold text-gray-100 border-b border-[#2D3748] pb-3">Booking Summary</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5 text-sm">
                  <div>
                    <p className="font-medium text-gray-400">Salon</p>
                    <p className="font-semibold text-gray-200">{bookingData.salonName || 'Unknown Salon'}</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-400">Date & Time</p>
                    <p className="font-semibold text-gray-200">{bookingData.month.slice(0,3)} {bookingData.date}, {bookingData.year} at {bookingData.time}</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-400">Services</p>
                    <p className="font-semibold text-gray-200">{bookingData.services.map(s => s.name).join(', ') || 'None selected'}</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-400">Stylist</p>
                    <p className="font-semibold text-gray-200">{bookingData.stylist}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="font-medium text-gray-400">Your Contact Details</p>
                    <p className="font-semibold text-gray-200">
                      {bookingData.userDetails.fullName || 'Missing Name'}, {bookingData.userDetails.email || 'Missing Email'}, {bookingData.userDetails.phone || 'Missing Phone'}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="font-medium text-gray-400">Special Request</p>
                    <p className="font-semibold text-gray-200 italic">
                      {bookingData.userDetails.specialRequest || 'No special request provided.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Payment Method Section */}
              <div className="p-6 bg-[#211d29]/50 border border-[#2D3748] rounded-xl flex flex-col gap-6 backdrop-blur-sm">
                <h2 className="text-lg font-bold text-gray-100">Payment Method</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Option 1: Online */}
                  <label className={`cursor-pointer p-4 rounded-lg border transition-all duration-200 flex flex-col items-center text-center gap-3 ${
                    paymentMethod === 'online' ? 'border-[#6B46C1] bg-[#6B46C1]/10 shadow-[0_0_8px_rgba(107,70,193,0.3)]' : 'border-[#2D3748] bg-[#17141e] hover:border-[#6B46C1]/50'
                  }`}>
                    <input type="radio" name="payment" value="online" className="sr-only" onChange={(e) => setPaymentMethod(e.target.value)} />
                    <span className="material-symbols-outlined text-[#6B46C1] text-4xl">credit_card</span>
                    <h3 className="font-bold text-gray-200">Pay Online Now (Demo)</h3>
                    <p className="text-xs text-gray-400">Complete your booking by paying securely online. This is a demo transaction.</p>
                  </label>

                  {/* Option 2: At Salon */}
                  <label className={`cursor-pointer p-4 rounded-lg border transition-all duration-200 flex flex-col items-center text-center gap-3 ${
                    paymentMethod === 'salon' ? 'border-[#6B46C1] bg-[#6B46C1]/10 shadow-[0_0_8px_rgba(107,70,193,0.3)]' : 'border-[#2D3748] bg-[#17141e] hover:border-[#6B46C1]/50'
                  }`}>
                    <input type="radio" name="payment" value="salon" className="sr-only" onChange={(e) => setPaymentMethod(e.target.value)} />
                    <span className="material-symbols-outlined text-[#6B46C1] text-4xl">storefront</span>
                    <h3 className="font-bold text-gray-200">Pay at Salon</h3>
                    <p className="text-xs text-gray-400">Reserve your spot now and pay with your preferred method after your service.</p>
                  </label>
                </div>

                {/* Terms Checkbox */}
                <div className="flex items-start mt-2">
                  <div className="flex items-center h-5">
                    <input 
                      type="checkbox" 
                      id="terms" 
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="h-4 w-4 rounded border-[#2D3748] bg-[#17141e] text-[#6B46C1] focus:ring-[#6B46C1] cursor-pointer" 
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="terms" className="font-medium text-gray-300 cursor-pointer">
                      I agree to the <span className="font-medium text-[#6B46C1] hover:underline">Terms and Conditions</span> and confirm all my booking details are correct.
                    </label>
                  </div>
                </div>
              </div>

            </div>

            {/* Sidebar Basket */}
            <div className="lg:col-span-1">
              <div className="sticky top-28 bg-[#211d29]/50 border border-[#2D3748] rounded-xl p-6 flex flex-col gap-6 backdrop-blur-sm">
                <h3 className="text-xl font-bold">Your Basket</h3>
                <div className="flex flex-col gap-4 border-b border-[#2D3748] pb-4">
                  {bookingData.services.map(item => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <div><p className="font-semibold">{item.name}</p></div>
                      <span className="font-medium">{formatLKR(item.price)}</span>
                    </div>
                  ))}
                </div>

                {/* Totals Calculation */}
                <div className="flex flex-col gap-2 text-sm text-gray-300">
                  <div className="flex justify-between"><span>Subtotal</span><span className="font-semibold">{formatLKR(bookingData.totalCost)}</span></div>
                  {bookingData.usePoints && (
                    <div className="flex justify-between text-[#FFD700]"><span>Loyalty Discount</span><span className="font-semibold">-{formatLKR(bookingData.discount)}</span></div>
                  )}
                  <div className="flex justify-between font-bold text-lg text-white pt-3 border-t border-[#2D3748] mt-2">
                    <span>Final Total Cost</span><span>{formatLKR(finalCost)}</span>
                  </div>
                </div>

                {/* Error Message */}
                {submitError && (
                  <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-sm p-3 rounded-lg text-center">
                    {submitError}
                  </div>
                )}

                <div className="flex flex-col gap-3 mt-4">
                  <button 
                    onClick={handleConfirmClick}
                    disabled={!paymentMethod || !agreedToTerms || isSubmitting}
                    className={`w-full h-12 rounded-lg font-bold transition-all duration-300 ${
                      paymentMethod && agreedToTerms && !isSubmitting
                      ? 'bg-[#6B46C1] text-white hover:bg-[#553c9a] shadow-[0_0_15px_rgba(107,70,193,0.5)] cursor-pointer' 
                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {isSubmitting ? 'Saving Booking...' : 'Confirm Booking'}
                  </button>
                  <button onClick={() => navigate(-1)} className="w-full border border-[#2D3748] h-12 rounded-lg text-gray-300 hover:bg-[#2D3748] transition-colors">
                    Back
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Demo Payment Gateway Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
          <div className="relative w-full max-w-md bg-[#1A1B26] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">

            {/* Form Step */}
            {paymentStep === 'form' && (
              <>
                <div className="px-6 py-4 border-b border-white/10 bg-white/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#6B46C1]/20 rounded-xl flex items-center justify-center">
                        <span className="material-symbols-outlined text-[#6B46C1]">credit_card</span>
                      </div>
                      <div>
                        <h3 className="text-white font-bold">Secure Payment</h3>
                        <p className="text-xs text-text-secondary">Demo Gateway — No real charges</p>
                      </div>
                    </div>
                    <button onClick={() => setShowPaymentModal(false)} className="text-text-secondary hover:text-white transition-colors">
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-5">
                  {/* Amount */}
                  <div className="bg-[#6B46C1]/10 border border-[#6B46C1]/20 rounded-xl p-4 text-center">
                    <p className="text-xs text-text-secondary">Amount to Pay</p>
                    <p className="text-3xl font-black text-white mt-1">{formatLKR(finalCost)}</p>
                  </div>

                  {/* Card Number */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-text-secondary">Card Number</label>
                    <div className="relative">
                      <input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)}
                        className="w-full bg-background-dark border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#6B46C1] focus:ring-1 focus:ring-[#6B46C1] tracking-wider"
                        placeholder="1234 5678 9012 3456" />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                        <span className="text-xs font-bold text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded">VISA</span>
                      </div>
                    </div>
                  </div>

                  {/* Expiry + CVV */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-text-secondary">Expiry Date</label>
                      <input value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value)}
                        className="w-full bg-background-dark border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#6B46C1] focus:ring-1 focus:ring-[#6B46C1]"
                        placeholder="MM/YY" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-text-secondary">CVV</label>
                      <input value={cardCvv} onChange={(e) => setCardCvv(e.target.value)}
                        className="w-full bg-background-dark border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#6B46C1] focus:ring-1 focus:ring-[#6B46C1]"
                        placeholder="123" type="password" />
                    </div>
                  </div>

                  {/* Cardholder Name */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-text-secondary">Cardholder Name</label>
                    <input value={cardName} onChange={(e) => setCardName(e.target.value)}
                      className="w-full bg-background-dark border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#6B46C1] focus:ring-1 focus:ring-[#6B46C1]"
                      placeholder="Name on card" />
                  </div>

                  {/* Security Notice */}
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <span className="material-symbols-outlined text-green-400 text-sm">lock</span>
                    <span>256-bit SSL encrypted. This is a demo — no real payment will be processed.</span>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-white/10 bg-white/5">
                  <button onClick={handlePayNow}
                    className="w-full bg-[#6B46C1] hover:bg-[#553c9a] text-white font-bold py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(107,70,193,0.4)]">
                    Pay {formatLKR(finalCost)}
                  </button>
                </div>
              </>
            )}

            {/* Processing Step */}
            {paymentStep === 'processing' && (
              <div className="p-12 flex flex-col items-center gap-6">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-[#6B46C1]/30 border-t-[#6B46C1] rounded-full animate-spin"></div>
                </div>
                <div className="text-center">
                  <p className="text-white font-bold text-lg">Processing Payment...</p>
                  <p className="text-text-secondary text-sm mt-1">Please wait while we verify your transaction.</p>
                </div>
              </div>
            )}

            {/* Success Step */}
            {paymentStep === 'success' && (
              <div className="p-12 flex flex-col items-center gap-6">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-green-400 text-5xl">check_circle</span>
                </div>
                <div className="text-center">
                  <p className="text-white font-bold text-lg">Payment Successful!</p>
                  <p className="text-text-secondary text-sm mt-1">Completing your booking...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingStep4;