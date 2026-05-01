import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from './firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const bookingId = searchParams.get('booking_id');
  const [status, setStatus] = useState('verifying'); // 'verifying' | 'success' | 'failed'

  useEffect(() => {
    const verifyAndUpdate = async () => {
      if (!sessionId || !bookingId) {
        setStatus('failed');
        return;
      }

      try {
        // Verify payment with our FastAPI backend
        const response = await fetch(`http://localhost:8000/verify-payment/${sessionId}`);
        if (!response.ok) throw new Error('Verification failed');
        const data = await response.json();

        if (data.paid) {
          // Update booking status from pending_payment to pending (awaiting admin approval)
          await updateDoc(doc(db, 'bookings', bookingId), {
            status: 'pending',
            paymentStatus: 'paid',
            stripeSessionId: sessionId,
          });

          // Run AI prediction in the background
          try {
            const bookingSnap = await getDoc(doc(db, 'bookings', bookingId));
            if (bookingSnap.exists()) {
              const booking = bookingSnap.data();

              // Count previous no-shows
              const { collection: col, query: q, where, getDocs: gd } = await import('firebase/firestore');
              const noShowQuery = q(col(db, 'bookings'), where('customerId', '==', booking.customerId), where('status', '==', 'no_show'));
              const noShowSnap = await gd(noShowQuery);
              const previousNoShows = noShowSnap.size;

              // Parse time
              const timeParts = (booking.time || '').match(/(\d+):(\d+)\s*(AM|PM)/i);
              let hourOfDay = 10;
              if (timeParts) {
                hourOfDay = parseInt(timeParts[1]);
                if (timeParts[3].toUpperCase() === 'PM' && hourOfDay !== 12) hourOfDay += 12;
                if (timeParts[3].toUpperCase() === 'AM' && hourOfDay === 12) hourOfDay = 0;
              }

              const monthIndex = ['January','February','March','April','May','June','July','August','September','October','November','December'].indexOf(booking.month);
              const appointmentDate = new Date(booking.year, monthIndex, booking.date);
              const dayOfWeek = appointmentDate.getDay();
              const dayOfWeekMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
              const leadTimeDays = Math.max(0, Math.round((appointmentDate - new Date()) / (1000 * 60 * 60 * 24)));
              const category = booking.services?.[0]?.category || 'Hair';

              const predRes = await fetch('http://localhost:8000/predict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  day_of_week: dayOfWeekMon,
                  hour_of_day: hourOfDay,
                  category: category,
                  lead_time_days: leadTimeDays,
                  payment_online: 1,
                  used_loyalty: booking.usedLoyaltyPoints ? 1 : 0,
                  previous_no_shows: previousNoShows,
                }),
              });

              if (predRes.ok) {
                const prediction = await predRes.json();
                await updateDoc(doc(db, 'bookings', bookingId), {
                  noShowRisk: prediction.risk_score,
                  noShowRiskLevel: prediction.risk_level,
                  noShowFactors: prediction.factors || [],
                });
              }
            }
          } catch (aiErr) {
            console.warn('AI prediction failed (non-blocking):', aiErr);
          }

          setStatus('success');

          // Retrieve recap from sessionStorage and navigate to success page
          const recap = sessionStorage.getItem('bookingRecap');
          const recapData = recap ? JSON.parse(recap) : {};
          sessionStorage.removeItem('bookingRecap');

          setTimeout(() => {
            navigate('/booking-success', {
              state: {
                salonName: recapData.salonName || 'Your Salon',
                services: recapData.services || [],
                month: recapData.month || '',
                date: recapData.date || '',
                year: recapData.year || '',
                time: recapData.time || '',
                stylist: recapData.stylist || '',
                paymentMethod: 'online',
              },
            });
          }, 2000);
        } else {
          setStatus('failed');
        }
      } catch (err) {
        console.error('Payment verification error:', err);
        setStatus('failed');
      }
    };

    verifyAndUpdate();
  }, [sessionId, bookingId, navigate]);

  return (
    <div className="min-h-screen bg-[#17141e] flex items-center justify-center">
      {status === 'verifying' && (
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="w-16 h-16 border-4 border-[#6B46C1]/30 border-t-[#6B46C1] rounded-full animate-spin"></div>
          <div>
            <h2 className="text-xl font-bold text-white">Verifying Payment...</h2>
            <p className="text-gray-400 text-sm mt-2">Please wait while we confirm your transaction.</p>
          </div>
        </div>
      )}

      {status === 'success' && (
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined text-green-400 text-5xl">check_circle</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Payment Successful!</h2>
            <p className="text-gray-400 text-sm mt-2">Redirecting to your booking confirmation...</p>
          </div>
        </div>
      )}

      {status === 'failed' && (
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined text-red-400 text-5xl">error</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Payment Failed</h2>
            <p className="text-gray-400 text-sm mt-2">Something went wrong with your payment. Please try again.</p>
          </div>
          <button onClick={() => navigate('/book-step4')} className="bg-[#6B46C1] hover:bg-[#553c9a] text-white font-bold px-6 py-3 rounded-xl transition-all">
            Try Again
          </button>
        </div>
      )}
    </div>
  );
};

export default PaymentSuccess;