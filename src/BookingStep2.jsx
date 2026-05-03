import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBooking } from './BookingContext';
import { db } from './firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { formatLKR } from './utils/formatLKR';

const BookingStep2 = () => {
  const navigate = useNavigate();
  const { bookingData, updateDateTime } = useBooking();

  // Initialize calendar to the current month and today's date
  const today = new Date();
  const todayDate = today.getDate();
  const todayMonth = today.getMonth();
  const todayYear = today.getFullYear();

  const [viewDate, setViewDate] = useState(new Date(todayYear, todayMonth, 1));
  const [bookedSlots, setBookedSlots] = useState(new Set());
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [staffList, setStaffList] = useState([]);

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();
  const monthName = viewDate.toLocaleString('default', { month: 'long' });

  // Calendar grid logic
  const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
  const startDay = new Date(currentYear, currentMonth, 1).getDay();

  // Check if a calendar day is in the past
  const isDayInPast = (day) => {
    const cellDate = new Date(currentYear, currentMonth, day);
    const todayStart = new Date(todayYear, todayMonth, todayDate);
    return cellDate < todayStart;
  };

  // Check if prev month button should be disabled (can't go before current month)
  const isPrevDisabled = currentYear === todayYear && currentMonth === todayMonth;

  // All possible time slots
  const allTimeSlots = [
    '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM',
    '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM',
    '01:00 PM', '01:30 PM', '02:00 PM', '02:30 PM',
    '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM',
    '05:00 PM',
  ];

  // Auto-select today's date on first render if no date is already selected
  useEffect(() => {
    if (!bookingData.date) {
      updateDateTime(todayDate, bookingData.time, monthName, todayYear, bookingData.stylist);
    }
  }, []);

  // Fetch staff for this salon
  useEffect(() => {
    const fetchStaff = async () => {
      if (!bookingData.salonId) return;
      try {
        const q = query(collection(db, 'staff'), where('salonId', '==', bookingData.salonId));
        const snap = await getDocs(q);
        setStaffList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('Error fetching staff:', err);
      }
    };
    fetchStaff();
  }, [bookingData.salonId]);

  // Fetch booked slots when the selected date changes
  useEffect(() => {
    const fetchBookedSlots = async () => {
      // Need a valid date selection and salonId to query
      if (!bookingData.date || !bookingData.salonId) return;

      setSlotsLoading(true);
      try {
        const selectedMonth = bookingData.month;
        const selectedDate = bookingData.date;
        const selectedYear = bookingData.year;

        // Query bookings for this salon on this specific date that aren't cancelled
        const q = query(
          collection(db, 'bookings'),
          where('salonId', '==', bookingData.salonId),
          where('month', '==', selectedMonth),
          where('date', '==', selectedDate),
          where('year', '==', selectedYear)
        );

        const snapshot = await getDocs(q);
        const booked = new Set();
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          // Only count non-cancelled bookings as blocking a slot
          if (data.status !== 'cancelled' && data.time) {
            booked.add(data.time);
          }
        });

        setBookedSlots(booked);
      } catch (err) {
        console.error('Error fetching booked slots:', err);
        setBookedSlots(new Set());
      } finally {
        setSlotsLoading(false);
      }
    };

    fetchBookedSlots();
  }, [bookingData.date, bookingData.month, bookingData.year, bookingData.salonId]);

  // Handle day click — only allow today and future
  const handleDayClick = (day) => {
    if (isDayInPast(day)) return;
    // Clear time selection when date changes (since available slots may differ)
    updateDateTime(day, '', monthName, currentYear, bookingData.stylist);
  };

  // Handle prev month navigation
  const handlePrevMonth = () => {
    if (isPrevDisabled) return;
    setViewDate(new Date(currentYear, currentMonth - 1, 1));
  };

  return (
    <div className="min-h-screen bg-[#17141e] text-[#E2E8F0] font-sans futuristic-gradient-bg">
      <header className="flex items-center justify-between border-b border-[#2D3748] bg-[#211d29]/50 backdrop-blur-sm px-6 md:px-20 py-4 sticky top-0 z-50">
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate('/home')}>
          <img src="/logo.png" alt="BookMyLook" className="h-8 w-auto" />
          <h2 className="text-xl font-bold tracking-tight">BookMyLook</h2>
        </div>
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white flex items-center gap-1 group transition-colors">
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
                <span className="material-symbols-outlined text-[#6B46C1] text-base">check</span>
                <span className="text-[#6B46C1] font-bold">Time</span>
                <span className="material-symbols-outlined text-gray-500 text-base">chevron_right</span>
                <span className="text-gray-400">Details</span>
                <span className="material-symbols-outlined text-gray-500 text-base">chevron_right</span>
                <span className="text-gray-400">Confirm</span>
              </div>
              <p className="text-sm">Step 2 of 4</p>
            </div>
            <div className="h-2 bg-[#2D3748] rounded-full overflow-hidden">
              <div className="h-full bg-[#6B46C1] transition-all duration-500" style={{ width: '50%' }}></div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <div>
                <h1 className="text-4xl font-black text-gray-100 mb-2">Choose Your Date & Time</h1>
                <p className="text-gray-400">Select an available date and time slot for your appointment.</p>
              </div>

              {/* Dynamic Calendar */}
              <div className="p-6 bg-[#211d29]/50 border border-[#2D3748] rounded-xl backdrop-blur-sm">
                <div className="flex items-center justify-between mb-6">
                  <button
                    onClick={handlePrevMonth}
                    disabled={isPrevDisabled}
                    className={`p-2 rounded-full transition-colors ${isPrevDisabled ? 'text-gray-600 cursor-not-allowed' : 'hover:bg-[#2D3748] text-white'}`}
                  >
                    <span className="material-symbols-outlined">chevron_left</span>
                  </button>
                  <h3 className="text-xl font-bold text-gray-200">{monthName} {currentYear}</h3>
                  <button onClick={() => setViewDate(new Date(currentYear, currentMonth + 1, 1))} className="p-2 rounded-full hover:bg-[#2D3748] transition-colors">
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-2 text-center text-sm">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-gray-400 font-semibold py-2">{day}</div>
                  ))}
                  {Array(startDay).fill(null).map((_, i) => <div key={`empty-${i}`}></div>)}
                  {Array.from({ length: totalDays }, (_, i) => i + 1).map(day => {
                    const past = isDayInPast(day);
                    const isSelected = bookingData.date === day && bookingData.month === monthName && bookingData.year === currentYear;
                    const isToday = day === todayDate && currentMonth === todayMonth && currentYear === todayYear;

                    return (
                      <div
                        key={day}
                        onClick={() => handleDayClick(day)}
                        className={`py-2 rounded-full transition-all relative ${
                          past
                            ? 'text-gray-700 cursor-not-allowed'
                            : isSelected
                              ? 'bg-[#6B46C1] text-white font-bold shadow-[0_0_12px_rgba(107,70,193,0.5)] cursor-pointer'
                              : 'hover:bg-[#2D3748] cursor-pointer text-gray-200'
                        }`}
                      >
                        {day}
                        {isToday && !isSelected && (
                          <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#6B46C1] rounded-full"></span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Stylist Dropdown */}
              <div className="space-y-4 px-4">
                <label className="text-lg font-bold text-gray-200">Choose a Stylist (Optional)</label>
                <select
                  className="w-full bg-[#211d29] border border-[#2D3748] text-[#E2E8F0] rounded-lg p-3 focus:ring-2 focus:ring-[#6B46C1] outline-none"
                  value={bookingData.stylist}
                  onChange={(e) => updateDateTime(bookingData.date, bookingData.time, monthName, currentYear, e.target.value)}
                >
                  <option>Any Available Stylist</option>
                  {staffList.map(staff => (
                    <option key={staff.id} value={staff.name}>{staff.name} — {staff.role}</option>
                  ))}
                  {staffList.length === 0 && <option disabled>No staff added yet</option>}
                </select>
              </div>

              {/* Time Slots */}
              <div className="space-y-4 px-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-200">
                    Available Slots for {bookingData.month ? bookingData.month.slice(0, 3) : monthName.slice(0, 3)} {bookingData.date || '—'}
                  </h3>
                  {slotsLoading && (
                    <div className="flex items-center gap-2 text-xs text-text-secondary">
                      <div className="w-3 h-3 border-2 border-[#6B46C1]/30 border-t-[#6B46C1] rounded-full animate-spin"></div>
                      Checking availability...
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {allTimeSlots.map((time) => {
                    const isBooked = bookedSlots.has(time);
                    const isSelected = bookingData.time === time;

                    return (
                      <button
                        key={time}
                        disabled={isBooked}
                        onClick={() => updateDateTime(bookingData.date, time, bookingData.month || monthName, bookingData.year || currentYear, bookingData.stylist)}
                        className={`p-3 text-center rounded-lg border transition-all duration-300 ${
                          isBooked
                            ? 'border-[#2D3748] bg-[#211d29] text-gray-600 cursor-not-allowed line-through'
                            : isSelected
                              ? 'border-[#6B46C1] bg-[#6B46C1] text-white shadow-[0_0_12px_rgba(107,70,193,0.4)]'
                              : 'border-[#2D3748] bg-[#211d29] hover:border-[#6B46C1] hover:text-[#6B46C1]'
                        }`}
                      >
                        {time}
                        {isBooked && <span className="block text-[10px] mt-0.5 no-underline text-gray-600" style={{ textDecoration: 'none' }}>Booked</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Sidebar Basket */}
            <div className="lg:col-span-1">
              <div className="sticky top-28 bg-[#211d29]/50 backdrop-blur-sm border border-[#2D3748] rounded-xl p-6 flex flex-col gap-6">
                <h3 className="text-xl font-bold">Your Basket</h3>
                <div className="flex flex-col gap-4 border-b border-[#2D3748] pb-4">
                  {bookingData.services.length === 0 ? (
                    <p className="text-gray-400 text-sm">No services selected.</p>
                  ) : (
                    bookingData.services.map(item => (
                      <div key={item.id} className="flex justify-between items-start text-sm">
                        <div>
                          <p className="font-semibold text-gray-200">{item.name}</p>
                          <p className="text-gray-400">{item.time}</p>
                        </div>
                        <span className="font-medium text-gray-300">{formatLKR(item.price)}</span>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex justify-between font-bold text-lg text-gray-100">
                  <span>Total Cost</span>
                  <span>{formatLKR(bookingData.totalCost)}</span>
                </div>
                <div className="flex flex-col gap-3">
                  <button
                    disabled={!bookingData.date || !bookingData.time}
                    onClick={() => navigate('/book-step3')}
                    className={`w-full h-12 rounded-lg font-bold transition-all shadow-md ${
                      bookingData.date && bookingData.time
                        ? 'bg-[#6B46C1] text-white hover:bg-purple-500 shadow-[0_0_15px_rgba(107,70,193,0.3)]'
                        : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Continue to Details
                  </button>
                  <button
                    onClick={() => navigate(-1)}
                    className="w-full h-12 rounded-lg border border-[#2D3748] text-gray-300 font-bold hover:bg-[#2D3748] transition-all"
                  >
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

export default BookingStep2;