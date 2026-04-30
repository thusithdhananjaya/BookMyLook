import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const BookingSuccess = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // All recap data now comes from router state (passed by BookingStep4)
  const recap = location.state || {};

  const paymentMethod = recap.paymentMethod === 'online' ? 'Paid Online (Demo)' : 'Pay at Salon';
  const servicesList = recap.services?.join(', ') || 'None selected';
  const userEmail = recap.userEmail || 'your email address';
  const salonName = recap.salonName || 'Unknown Salon';
  const month = recap.month || '';
  const date = recap.date || '';
  const year = recap.year || '';
  const time = recap.time || '';
  const stylist = recap.stylist || 'Any Available Stylist';

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[#17141e] text-[#E2E8F0] font-sans futuristic-gradient-bg">
      <main className="w-full max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col items-center gap-8 text-center">
          
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center justify-center h-24 w-24 rounded-full bg-[#FFD700]/10">
              <span className="material-symbols-outlined text-[#FFD700] text-6xl drop-shadow-[0_0_10px_#FFD700]">check_circle</span>
            </div>
            <h1 className="text-4xl font-black leading-tight text-gray-100">Appointment Confirmed!</h1>
            <p className="text-gray-400 text-base font-normal max-w-md">
              We've sent a confirmation email to <span className="font-semibold text-gray-300">{userEmail}</span>.
            </p>
          </div>

          <div className="w-full p-6 bg-[#211d29]/50 border border-[#2D3748] rounded-xl backdrop-blur-sm flex flex-col gap-6 text-left shadow-[0_0_8px_rgba(107,70,193,0.3)]">
            <h2 className="text-lg font-bold text-gray-100 border-b border-[#2D3748] pb-3">Booking Recap</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5 text-sm">
              <div>
                <p className="font-medium text-gray-400">Salon</p>
                <p className="font-semibold text-gray-200">{salonName}</p>
              </div>
              <div>
                <p className="font-medium text-gray-400">Date & Time</p>
                <p className="font-semibold text-gray-200">{month.slice(0,3)} {date}, {year} at {time}</p>
              </div>
              <div>
                <p className="font-medium text-gray-400">Services</p>
                <p className="font-semibold text-gray-200">{servicesList}</p>
              </div>
              <div>
                <p className="font-medium text-gray-400">Stylist</p>
                <p className="font-semibold text-gray-200">{stylist}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="font-medium text-gray-400">Payment Status</p>
                <p className="font-semibold text-gray-200">{paymentMethod}</p>
              </div>
            </div>

            <div className="border-t border-[#2D3748] pt-4">
              <button className="inline-flex items-center gap-2 text-[#6B46C1] font-medium hover:underline transition-all">
                <span className="material-symbols-outlined text-xl">calendar_add_on</span>
                <span>Add to Calendar</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-sm mt-4">
            <button 
              onClick={() => navigate('/my-appointments')}
              className="w-full h-12 rounded-lg bg-[#6B46C1] text-white font-bold hover:bg-purple-500 shadow-[0_0_15px_rgba(107,70,193,0.5)] transition-all"
            >
              View My Appointments
            </button>
            <button 
              onClick={() => navigate('/home')}
              className="w-full sm:w-auto text-gray-300 hover:text-white hover:underline font-medium py-2 px-4 transition-colors"
            >
              Back to Home
            </button>
          </div>

        </div>
      </main>
    </div>
  );
};

export default BookingSuccess;