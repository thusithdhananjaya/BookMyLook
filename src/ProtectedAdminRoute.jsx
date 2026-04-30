import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

const ProtectedAdminRoute = ({ children }) => {
  const { currentUser } = useAuth();
  const [role, setRole] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }
      try {
        const docRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setRole(docSnap.data().role);
          setStatus(docSnap.data().status);
        }
      } catch (err) {
        console.error('Error fetching user role:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRole();
  }, [currentUser]);

  // Still checking auth/role
  if (loading) {
    return (
      <div className="min-h-screen bg-background-dark flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  // Not logged in
  if (!currentUser) {
    return <Navigate to="/admin-login" replace />;
  }

  // Logged in but is a customer — redirect to customer portal
  if (role === 'customer') {
    return <Navigate to="/home" replace />;
  }

  // Admin but not approved
  if (role === 'admin' && status !== 'approved') {
    return <Navigate to="/admin-login" replace />;
  }

  // Approved admin — allow access
  return children;
};

export default ProtectedAdminRoute;