import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db, storage } from './firebase'; // <-- Storage imported here
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'; // <-- Storage functions

function AdminLoginPage() {
  const [activeTab, setActiveTab] = useState('login'); 
  const navigate = useNavigate();

  // Login State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Registration State (Auth)
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  
  // Registration State (Salon Details)
  const [salonName, setSalonName] = useState('');
  const [salonAddress, setSalonAddress] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [openTime, setOpenTime] = useState('09:00');
  const [closeTime, setCloseTime] = useState('18:00');
  const [aboutSalon, setAboutSalon] = useState('');
  const [logoFile, setLogoFile] = useState(null); // <-- NEW: State to hold the selected image
  
  // Error and Loading States
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAuth = async () => {
    setError('');
    setIsLoading(true);

    try {
      if (activeTab === 'login') {
        const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
        const user = userCredential.user;

        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists() || docSnap.data().role !== 'admin') {
          await signOut(auth);
          throw new Error("Access denied. You do not have a Salon Owner account.");
        }

        if (docSnap.data().status !== 'approved') {
          await signOut(auth);
          throw new Error("Your account is still pending approval. We will contact you soon!");
        }

        navigate('/admin-dashboard');
      } else {
        if (regPassword !== regConfirmPassword) throw new Error("Passwords do not match!");

        if (!salonName || !salonAddress || !contactPhone || !regEmail || !regPassword) {
          throw new Error("Please fill in all required salon details.");
        }
        
        const userCredential = await createUserWithEmailAndPassword(auth, regEmail, regPassword);
        const user = userCredential.user;
        
        // --- LOGO UPLOAD LOGIC ---
        let logoUrl = ""; 
        if (logoFile) {
          // 1. Create a reference to where we want to save it (logos/USER_ID)
          const storageRef = ref(storage, `logos/${user.uid}`);
          // 2. Upload the file
          await uploadBytes(storageRef, logoFile);
          // 3. Get the permanent public URL
          logoUrl = await getDownloadURL(storageRef);
        }
        
        // Save to Firestore Database
        await setDoc(doc(db, "users", user.uid), {
          email: regEmail,
          role: "admin", 
          status: "pending", 
          salonName: salonName,
          salonAddress: salonAddress,
          contactPhone: contactPhone,
          logoUrl: logoUrl, // <-- Save the image URL in the database!
          operatingHours: {
            open: openTime,
            close: closeTime
          },
          aboutSalon: aboutSalon,
          createdAt: new Date()
        });
        
        await signOut(auth);
        alert("Registration successful! Your application is pending review.");
        setActiveTab('login');
      }
    } catch (err) {
      console.error(err);
      let friendlyError = err.message.replace('Firebase: ', '');
      setError(friendlyError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-background-dark p-4 overflow-hidden font-display text-text-dark">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute -top-1/4 -left-1/4 h-1/2 w-1/2 rounded-full bg-primary/20 blur-3xl"></div>
        <div className="absolute -bottom-1/4 -right-1/4 h-1/2 w-1/2 rounded-full bg-secondary/10 blur-3xl"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]"></div>
      </div>

      <div className={`relative z-10 flex h-full w-full grow flex-col items-center justify-center transition-all duration-500 ${activeTab === 'login' ? 'max-w-md' : 'max-w-2xl py-12'}`}>
        
        <div className="flex w-full flex-col items-center pb-8 pt-6">
          <h1 className="text-text-dark tracking-tight text-4xl font-bold leading-tight text-center">
            {activeTab === 'login' ? 'Salon Portal' : 'Salon Registration'}
          </h1>
          <p className="text-placeholder-dark mt-2 text-center">
            {activeTab === 'login' ? 'Welcome back, owner!' : 'Tell us more about your salon to get started.'}
          </p>
        </div>

        <div className="flex w-full flex-col items-stretch justify-start rounded-xl border border-border-dark/50 bg-background-dark/50 p-4 shadow-2xl shadow-primary/10 backdrop-blur-lg sm:p-6 md:p-8">
          
          <div className="relative flex mb-8">
            <div className="relative flex h-11 flex-1 items-center justify-center rounded-lg bg-[#2D3748]/50 p-1">
              <div className={`absolute left-1 top-1 h-[calc(100%-8px)] w-[calc(50%-4px)] rounded-md bg-primary transition-transform duration-300 ease-in-out ${activeTab === 'register' ? 'translate-x-full' : ''}`}></div>
              
              <button type="button" onClick={() => { setActiveTab('login'); setError(''); }} className={`relative z-10 flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-lg px-2 text-sm font-medium transition-colors ${activeTab === 'login' ? 'text-white' : 'text-placeholder-dark hover:text-white'}`}>Login</button>
              <button type="button" onClick={() => { setActiveTab('register'); setError(''); }} className={`relative z-10 flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-lg px-2 text-sm font-medium transition-colors ${activeTab === 'register' ? 'text-white' : 'text-placeholder-dark hover:text-white'}`}>Register</button>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            {activeTab === 'login' && (
              <div className="flex flex-col gap-5 animate-fade-in">
                <div className="relative w-full">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-placeholder-dark pointer-events-none">mail</span>
                  <input value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg border border-border-dark bg-background-dark/50 py-3 pl-11 pr-4 text-base text-text-dark placeholder:text-placeholder-dark focus:border-primary focus:ring-2 focus:ring-primary/50" placeholder="Enter your email" type="email" />
                </div>
                <div className="relative w-full">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-placeholder-dark pointer-events-none">lock</span>
                  <input value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg border border-border-dark bg-background-dark/50 py-3 pl-11 pr-10 text-base text-text-dark placeholder:text-placeholder-dark focus:border-primary focus:ring-2 focus:ring-primary/50" placeholder="Enter your password" type="password" />
                </div>
              </div>
            )}

            {activeTab === 'register' && (
              <div className="flex flex-col gap-5 animate-fade-in">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div className="relative w-full">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-placeholder-dark pointer-events-none">store</span>
                    <input value={salonName} onChange={(e) => setSalonName(e.target.value)} className="form-input flex w-full min-w-0 flex-1 rounded-lg border border-border-dark bg-background-dark/50 py-3 pl-11 pr-4 text-base text-text-dark placeholder:text-placeholder-dark focus:border-primary focus:ring-2 focus:ring-primary/50" placeholder="Salon Name" type="text" />
                  </div>
                  <div className="relative w-full">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-placeholder-dark pointer-events-none">location_on</span>
                    <input value={salonAddress} onChange={(e) => setSalonAddress(e.target.value)} className="form-input flex w-full min-w-0 flex-1 rounded-lg border border-border-dark bg-background-dark/50 py-3 pl-11 pr-4 text-base text-text-dark placeholder:text-placeholder-dark focus:border-primary focus:ring-2 focus:ring-primary/50" placeholder="Salon Address" type="text" />
                  </div>
                  <div className="relative w-full">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-placeholder-dark pointer-events-none">phone</span>
                    <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="form-input flex w-full min-w-0 flex-1 rounded-lg border border-border-dark bg-background-dark/50 py-3 pl-11 pr-4 text-base text-text-dark placeholder:text-placeholder-dark focus:border-primary focus:ring-2 focus:ring-primary/50" placeholder="Contact Phone Number" type="tel" />
                  </div>
                  <div className="relative w-full">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-placeholder-dark pointer-events-none">mail</span>
                    <input value={regEmail} onChange={(e) => setRegEmail(e.target.value)} className="form-input flex w-full min-w-0 flex-1 rounded-lg border border-border-dark bg-background-dark/50 py-3 pl-11 pr-4 text-base text-text-dark placeholder:text-placeholder-dark focus:border-primary focus:ring-2 focus:ring-primary/50" placeholder="Admin Login Email" type="email" />
                  </div>
                  <div className="relative w-full">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-placeholder-dark pointer-events-none">lock</span>
                    <input value={regPassword} onChange={(e) => setRegPassword(e.target.value)} className="form-input flex w-full min-w-0 flex-1 rounded-lg border border-border-dark bg-background-dark/50 py-3 pl-11 pr-4 text-base text-text-dark placeholder:text-placeholder-dark focus:border-primary focus:ring-2 focus:ring-primary/50" placeholder="Create Password" type="password" />
                  </div>
                  <div className="relative w-full">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-placeholder-dark pointer-events-none">lock_reset</span>
                    <input value={regConfirmPassword} onChange={(e) => setRegConfirmPassword(e.target.value)} className="form-input flex w-full min-w-0 flex-1 rounded-lg border border-border-dark bg-background-dark/50 py-3 pl-11 pr-4 text-base text-text-dark placeholder:text-placeholder-dark focus:border-primary focus:ring-2 focus:ring-primary/50" placeholder="Confirm Password" type="password" />
                  </div>
                </div>
                
                <div className="relative w-full border-t border-border-dark/50 pt-4 mt-2">
                  <label className="mb-4 block text-sm font-bold text-text-dark">Standard Operating Hours</label>
                  <div className="flex flex-col sm:flex-row items-center gap-4 w-full">
                    <div className="flex w-full sm:w-1/2 items-center gap-3">
                      <label className="text-sm text-placeholder-dark w-12">Open:</label>
                      <input value={openTime} onChange={(e) => setOpenTime(e.target.value)} className="form-input w-full min-w-0 rounded-lg border border-border-dark bg-background-dark/50 text-text-dark focus:border-primary focus:ring-2 focus:ring-primary/50" type="time" />
                    </div>
                    <span className="hidden sm:block text-placeholder-dark">-</span>
                    <div className="flex w-full sm:w-1/2 items-center gap-3">
                      <label className="text-sm text-placeholder-dark w-12">Close:</label>
                      <input value={closeTime} onChange={(e) => setCloseTime(e.target.value)} className="form-input w-full min-w-0 rounded-lg border border-border-dark bg-background-dark/50 text-text-dark focus:border-primary focus:ring-2 focus:ring-primary/50" type="time" />
                    </div>
                  </div>
                </div>

                <div className="relative w-full pt-2 mt-2">
                  <textarea value={aboutSalon} onChange={(e) => setAboutSalon(e.target.value)} className="form-textarea flex w-full min-w-0 flex-1 resize-y rounded-lg border border-border-dark bg-background-dark/50 p-4 text-base text-text-dark placeholder:text-placeholder-dark focus:border-primary focus:ring-2 focus:ring-primary/50" placeholder="About Your Salon" rows="3"></textarea>
                </div>
                
                {/* --- THIS IS THE NEW CLICKABLE LOGO UPLOAD BOX --- */}
                <div className="relative w-full">
                  <label className="block text-sm font-medium text-text-dark mb-2">Salon Logo</label>
                  <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${logoFile ? 'border-primary bg-primary/10' : 'border-border-dark bg-background-dark/30 hover:bg-background-dark/50'}`}>
                    <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                      {logoFile ? (
                        <>
                          <span className="material-symbols-outlined text-primary mb-2 text-3xl">check_circle</span>
                          <p className="text-sm font-medium text-primary break-all">{logoFile.name}</p>
                          <p className="text-xs text-placeholder-dark mt-1">Click to change</p>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-placeholder-dark mb-2 text-3xl">upload_file</span>
                          <p className="mb-2 text-sm text-placeholder-dark"><span className="font-semibold text-primary">Click to upload</span> or drag and drop</p>
                          <p className="text-xs text-placeholder-dark">PNG, JPG, or GIF (MAX. 800x400px)</p>
                        </>
                      )}
                    </div>
                    <input 
                      className="hidden" 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files[0]) {
                          setLogoFile(e.target.files[0]);
                        }
                      }} 
                    />
                  </label>
                </div>

              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-sm p-3 rounded-lg text-center animate-fade-in">
                {error}
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-col-reverse sm:flex-row sm:justify-end sm:gap-4">
            {activeTab === 'register' && (
              <button type="button" onClick={() => setActiveTab('login')} className="mt-4 sm:mt-0 flex h-12 w-full sm:w-auto items-center justify-center rounded-lg border border-border-dark bg-transparent px-6 text-base font-bold text-text-dark transition-colors duration-300 hover:bg-border-dark/20">Cancel</button>
            )}
            <button onClick={handleAuth} disabled={isLoading} className="flex h-12 w-full sm:w-auto grow items-center justify-center rounded-lg bg-primary px-6 text-base font-bold text-white shadow-lg shadow-primary/30 transition-all duration-300 hover:shadow-glow-primary-md disabled:opacity-50 disabled:cursor-not-allowed"> 
              {isLoading ? 'Processing...' : (activeTab === 'login' ? 'Login' : 'Register Salon')} 
            </button>
          </div>
          
          {activeTab === 'login' && (
            <div className="mt-8 border-t border-border-dark/50 pt-4 text-center">
              <p className="text-xs text-placeholder-dark"> 
                Not a salon owner? <button onClick={() => navigate('/login')} className="font-medium text-primary hover:underline">Return to Customer Login</button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminLoginPage;