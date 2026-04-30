import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

const ProtectedRoute = ({ children }) => {
  const { currentUser } = useAuth();

  // If there is no user logged in, redirect them to the login page ("/")
  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  // If they ARE logged in, let them see the page!
  return children;
};

export default ProtectedRoute;