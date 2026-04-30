import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from './firebase'; // <-- ADD 'db' here
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth'; // <-- Added signOut
import { doc, setDoc, getDoc } from 'firebase/firestore'; // <-- Added getDoc

function LoginPage() {
  const [activeTab, setActiveTab] = useState('login'); // Controls 'login' or 'register'
  const navigate = useNavigate();

  // --- NEW: State variables to hold input data ---
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // --- NEW: State for errors and loading ---
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // --- NEW: The actual Firebase Auth Function ---
  const handleAuth = async () => {
    // 1. Clear any previous errors and start loading spinner
    setError('');
    setIsLoading(true);

    try {
      if (activeTab === 'register') {
        if (password !== confirmPassword) throw new Error("Passwords do not match!");
        if (!name) throw new Error("Please enter your name.");
        
        // 1. Create user in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // 2. Save their display name
        await updateProfile(user, { displayName: name });

        // 3. Save their ROLE and initial loyalty points to the Firestore Database
        await setDoc(doc(db, "users", user.uid), {
          name: name,
          email: email,
          role: "customer",
          loyaltyPoints: 0,
          createdAt: new Date()
        });

        navigate('/home');

      } else {
        // --- LOGIN LOGIC ---
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Fetch their wristband (role) from the database
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists() && docSnap.data().role === 'admin') {
          // They are an admin! Kick them out of the customer portal.
          await signOut(auth);
          throw new Error("This portal is for customers. Please use the Salon Portal.");
        }
        
        // Success! They are a customer. Go to dashboard.
        navigate('/home');
      }
      
    } catch (err) {
      // If Firebase throws an error (like "Email already in use" or "Wrong password"), show it to the user!
      console.error(err);
      // Clean up Firebase error messages to look nicer
      let friendlyError = err.message.replace('Firebase: ', '');
      setError(friendlyError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-background-dark p-4 overflow-hidden font-display text-text-dark">
      {/* Background Blobs */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute -top-1/4 -left-1/4 h-1/2 w-1/2 rounded-full bg-primary/20 blur-3xl"></div>
        <div className="absolute -bottom-1/4 -right-1/4 h-1/2 w-1/2 rounded-full bg-secondary/10 blur-3xl"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]"></div>
      </div>

      {/* Main Card */}
      <div className="relative z-10 flex h-full w-full max-w-md grow flex-col items-center justify-center">
        
        {/* Header Section */}
        <div className="flex w-full flex-col items-center pb-8 pt-6">
          <h1 className="text-text-dark tracking-tight text-4xl font-bold leading-tight text-center">BookMyLook</h1>
          <p className="text-placeholder-dark mt-2">The future of salon booking is here.</p>
        </div>

        {/* The Glassy Form Container */}
        <div className="flex w-full flex-col items-stretch justify-start rounded-xl border border-border-dark/50 bg-background-dark/50 p-4 shadow-2xl shadow-primary/10 backdrop-blur-lg sm:p-6 md:p-8">
          
          {/* Toggle Switch */}
          <div className="relative flex mb-8">
            <div className="relative flex h-11 flex-1 items-center justify-center rounded-lg bg-[#2D3748]/50 p-1">
              <div 
                className={`absolute left-1 top-1 h-[calc(100%-8px)] w-[calc(50%-4px)] rounded-md bg-primary transition-transform duration-300 ease-in-out ${activeTab === 'register' ? 'translate-x-full' : ''}`}
              ></div>
              
              <button 
                onClick={() => {
                  setActiveTab('login');
                  setError(''); // Clear errors when switching tabs
                }} 
                className={`relative z-10 flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-lg px-2 text-sm font-medium transition-colors ${activeTab === 'login' ? 'text-white' : 'text-placeholder-dark hover:text-white'}`}
              >
                Login
              </button>
              <button 
                onClick={() => {
                  setActiveTab('register');
                  setError(''); // Clear errors when switching tabs
                }} 
                className={`relative z-10 flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-lg px-2 text-sm font-medium transition-colors ${activeTab === 'register' ? 'text-white' : 'text-placeholder-dark hover:text-white'}`}
              >
                Register
              </button>
            </div>
          </div>

          {/* Form Fields Container */}
          <div className="flex flex-col gap-5">
            
            {/* FULL NAME (Only shows in Register mode) */}
            {activeTab === 'register' && (
              <div className="relative w-full animate-fade-in">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-placeholder-dark pointer-events-none">person</span>
                <input 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg border border-border-dark bg-background-dark/50 py-3 pl-11 pr-4 text-base text-text-dark placeholder:text-placeholder-dark focus:border-primary focus:ring-2 focus:ring-primary/50" 
                  placeholder="Enter your full name" 
                  type="text" 
                />
              </div>
            )}

            {/* EMAIL (Always visible) */}
            <div className="relative w-full">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-placeholder-dark pointer-events-none">mail</span>
              <input 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg border border-border-dark bg-background-dark/50 py-3 pl-11 pr-4 text-base text-text-dark placeholder:text-placeholder-dark focus:border-primary focus:ring-2 focus:ring-primary/50" 
                placeholder="Enter your email" 
                type="email" 
              />
            </div>

            {/* PASSWORD (Always visible) */}
            <div className="relative w-full">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-placeholder-dark pointer-events-none">lock</span>
              <input 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg border border-border-dark bg-background-dark/50 py-3 pl-11 pr-10 text-base text-text-dark placeholder:text-placeholder-dark focus:border-primary focus:ring-2 focus:ring-primary/50" 
                placeholder="Enter your password" 
                type="password" 
              />
            </div>

            {/* CONFIRM PASSWORD (Only shows in Register mode) */}
            {activeTab === 'register' && (
              <div className="relative w-full animate-fade-in">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-placeholder-dark pointer-events-none">lock_reset</span>
                <input 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg border border-border-dark bg-background-dark/50 py-3 pl-11 pr-10 text-base text-text-dark placeholder:text-placeholder-dark focus:border-primary focus:ring-2 focus:ring-primary/50" 
                  placeholder="Confirm your password" 
                  type="password" 
                />
              </div>
            )}

            {/* Forgot Password Link (Only shows in Login mode) */}
            {activeTab === 'login' && (
              <div className="flex justify-end">
                <a className="text-sm font-medium text-primary hover:underline" href="#">Forgot Password?</a>
              </div>
            )}

            {/* ERROR MESSAGE DISPLAY */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-sm p-3 rounded-lg text-center animate-fade-in">
                {error}
              </div>
            )}

            {/* Salon Owner Link */}
            <div className="flex items-center justify-center pt-2 mt-2 border-t border-border-dark/50">
              <button 
                type="button"
                onClick={() => navigate('/admin-login')} 
                className="text-sm font-medium text-placeholder-dark hover:text-white transition-colors"
              >
                Own a salon? <span className="text-primary hover:underline">Go to Admin Portal</span>
              </button>
            </div>
          </div>

          {/* Action Button */}
          <button 
            onClick={handleAuth} 
            disabled={isLoading}
            className="mt-8 flex h-12 w-full items-center justify-center rounded-lg bg-primary px-6 text-base font-bold text-white shadow-lg shadow-primary/30 transition-all duration-300 hover:shadow-glow-primary-md disabled:opacity-50 disabled:cursor-not-allowed"
          > 
            {isLoading ? 'Processing...' : (activeTab === 'login' ? 'Login' : 'Sign Up')} 
          </button>
          
          {/* Footer Terms */}
          <p className="mt-8 text-center text-xs text-placeholder-dark"> 
            By creating an account, you agree to our <a className="font-medium text-primary hover:underline" href="#">Terms</a> & <a className="font-medium text-primary hover:underline" href="#">Privacy Policy</a>. 
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;