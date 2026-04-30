// src/BookingContext.jsx
import React, { createContext, useState, useContext } from 'react';

const BookingContext = createContext();

// Default state extracted so resetBooking can reuse it
const getInitialBookingState = () => ({
  // Salon info — set when customer clicks "Book Now" on a salon page
  salonId: '',
  salonName: '',

  // Services selected in Step 1
  services: [],

  // Date & time selected in Step 2
  date: new Date().getDate(),
  month: new Date().toLocaleString('default', { month: 'long' }),
  year: new Date().getFullYear(),
  time: '10:30 AM',
  stylist: 'Any Available Stylist',

  // Cost
  totalCost: 0,

  // User details from Step 3
  userDetails: {
    fullName: '',
    email: '',
    phone: '',
    specialRequest: ''
  },

  // Loyalty
  usePoints: false,
  discount: 0
});

// Loyalty constants — single source of truth
export const LOYALTY_REDEEM_COST = 500;      // Points required to redeem
export const LOYALTY_DISCOUNT_LKR = 500;     // Discount amount in LKR when redeemed
export const LOYALTY_EARN_RATE = 10;         // Earn 1 point per this many LKR spent

export const BookingProvider = ({ children }) => {
  const [bookingData, setBookingData] = useState(getInitialBookingState());

  // Set which salon this booking is for (called from SalonDetails)
  const setSalon = (salonId, salonName) => {
    setBookingData(prev => ({ ...prev, salonId, salonName }));
  };

  const toggleService = (service) => {
    setBookingData(prev => {
      const isSelected = prev.services.find(s => s.id === service.id);
      const newServices = isSelected 
        ? prev.services.filter(s => s.id !== service.id)
        : [...prev.services, service];
      
      const newTotal = newServices.reduce((acc, s) => acc + s.price, 0);
      return { ...prev, services: newServices, totalCost: newTotal };
    });
  };

  const updateDateTime = (date, time, month, year, stylist) => {
    setBookingData(prev => ({ 
      ...prev, date, time, month, year, 
      stylist: stylist || prev.stylist 
    }));
  };

  const updateUserDetails = (field, value) => {
    setBookingData(prev => ({
      ...prev,
      userDetails: { ...prev.userDetails, [field]: value }
    }));
  };

  const toggleLoyaltyPoints = () => {
    setBookingData(prev => ({
      ...prev,
      usePoints: !prev.usePoints,
      discount: !prev.usePoints ? LOYALTY_DISCOUNT_LKR : 0
    }));
  };

  // Clear all booking data after a successful submission
  const resetBooking = () => {
    setBookingData(getInitialBookingState());
  };

  return (
    <BookingContext.Provider value={{ 
      bookingData, 
      setSalon,
      toggleService, 
      updateDateTime, 
      updateUserDetails, 
      toggleLoyaltyPoints,
      resetBooking
    }}>
      {children}
    </BookingContext.Provider>
  );
};

export const useBooking = () => useContext(BookingContext);