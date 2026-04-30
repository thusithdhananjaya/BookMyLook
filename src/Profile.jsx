import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { auth, db } from './firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import CustomerLayout from './CustomerLayout';

const Profile = () => {
  const { currentUser } = useAuth();
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });

  const [preferences, setPreferences] = useState({
    emailNotifs: true,
    smsReminders: true,
    marketing: false,
  });

  // Load user data from Firestore on mount
  useEffect(() => {
    const fetchUserData = async () => {
      if (!currentUser) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          const fullName = data.name || currentUser.displayName || '';
          const nameParts = fullName.split(' ');

          setFormData({
            firstName: nameParts[0] || '',
            lastName: nameParts.slice(1).join(' ') || '',
            email: data.email || currentUser.email || '',
            phone: data.phone || '',
          });

          setLoyaltyPoints(data.loyaltyPoints || 0);

          // Load saved preferences if they exist
          if (data.preferences) {
            setPreferences({
              emailNotifs: data.preferences.emailNotifs ?? true,
              smsReminders: data.preferences.smsReminders ?? true,
              marketing: data.preferences.marketing ?? false,
            });
          }
        } else {
          // Fallback to Auth data
          setFormData({
            firstName: currentUser.displayName?.split(' ')[0] || '',
            lastName: currentUser.displayName?.split(' ').slice(1).join(' ') || '',
            email: currentUser.email || '',
            phone: '',
          });
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
  }, [currentUser]);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setSaveMessage(''); // Clear any previous message when user edits
  };

  const togglePreference = (key) => {
    setPreferences({ ...preferences, [key]: !preferences[key] });
    setSaveMessage('');
  };

  // Save changes to Firestore and Firebase Auth
  const handleSave = async () => {
    if (!formData.firstName.trim()) {
      setSaveMessage('error:First name is required.');
      return;
    }
    setIsSaving(true);
    setSaveMessage('');
    try {
      const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim();

      // Update Firestore user document
      await updateDoc(doc(db, 'users', currentUser.uid), {
        name: fullName,
        email: formData.email,
        phone: formData.phone,
        preferences: preferences,
      });

      // Update Firebase Auth display name
      await updateProfile(auth.currentUser, { displayName: fullName });

      setSaveMessage('success:Profile updated successfully!');
    } catch (err) {
      console.error('Error saving profile:', err);
      setSaveMessage('error:Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <CustomerLayout activePage="profile">
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin"></div>
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout activePage="profile">
      <header className="mb-10">
        <h2 className="text-3xl font-bold text-white mb-2 tracking-tighter">My Profile</h2>
        <p className="text-text-secondary">Manage your personal information and preferences.</p>
      </header>
      
      <div className="max-w-5xl space-y-8 pb-12">
        
        {/* Profile Overview Card */}
        <section className="bg-card-dark p-8 rounded-3xl border border-white/5 flex flex-col md:flex-row items-center gap-8 shadow-sm">
          <div className="relative group cursor-pointer">
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-brand-purple/20 p-1">
              <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&q=80" alt="Profile" className="w-full h-full object-cover rounded-full" />
            </div>
            <div className="absolute bottom-1 right-1 bg-brand-purple p-2 rounded-full shadow-lg border-2 border-card-dark hover:bg-[#8b5cf6] transition-colors duration-200">
              <span className="material-symbols-outlined text-sm text-white">photo_camera</span>
            </div>
          </div>
          <div className="text-center md:text-left flex-1">
            <h3 className="text-2xl font-bold text-white tracking-tight">
              {formData.firstName} {formData.lastName}
            </h3>
            <p className="text-[#8b5cf6] font-medium flex items-center justify-center md:justify-start gap-2 mt-1">
              <span className="w-2 h-2 bg-[#8b5cf6] rounded-full animate-pulse"></span>
              Premium Member
            </p>
            <p className="text-text-secondary text-sm mt-1">{formData.email}</p>
          </div>
          {/* Loyalty Points Badge */}
          <div className="flex flex-col items-center bg-[#FFD700]/10 border border-[#FFD700]/20 rounded-2xl px-6 py-4 min-w-[140px]">
            <span className="material-symbols-outlined text-[#FFD700] text-3xl mb-1">loyalty</span>
            <p className="text-2xl font-bold text-white">{loyaltyPoints.toLocaleString()}</p>
            <p className="text-xs text-[#FFD700]/80 font-medium">Loyalty Points</p>
          </div>
        </section>
        
        {/* Two Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Personal Info */}
          <section className="bg-card-dark p-8 rounded-3xl border border-white/5">
            <h4 className="text-lg font-semibold mb-6 flex items-center gap-2 tracking-tight">
              <span className="material-symbols-outlined text-[#8b5cf6]">person</span>
              Personal Details
            </h4>
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-text-secondary ml-1 font-medium">First Name *</label>
                  <input type="text" name="firstName" value={formData.firstName} onChange={handleInputChange}
                    className="w-full bg-background-dark border border-white/10 rounded-xl px-4 py-3 focus:ring-1 focus:ring-brand-purple focus:border-brand-purple text-white outline-none transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-text-secondary ml-1 font-medium">Last Name</label>
                  <input type="text" name="lastName" value={formData.lastName} onChange={handleInputChange}
                    className="w-full bg-background-dark border border-white/10 rounded-xl px-4 py-3 focus:ring-1 focus:ring-brand-purple focus:border-brand-purple text-white outline-none transition-all" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-text-secondary ml-1 font-medium">Email Address</label>
                <input type="email" name="email" value={formData.email} disabled
                  className="w-full bg-background-dark border border-white/10 rounded-xl px-4 py-3 text-white/50 outline-none cursor-not-allowed" />
                <p className="text-xs text-text-secondary ml-1">Email cannot be changed here. Contact support if needed.</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-text-secondary ml-1 font-medium">Phone Number</label>
                <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange}
                  placeholder="+94 7X XXX XXXX"
                  className="w-full bg-background-dark border border-white/10 rounded-xl px-4 py-3 focus:ring-1 focus:ring-brand-purple focus:border-brand-purple text-white outline-none transition-all placeholder-text-secondary/50" />
              </div>
            </div>
          </section>
          
          {/* Preferences & Security */}
          <section className="bg-card-dark p-8 rounded-3xl border border-white/5 flex flex-col">
            <h4 className="text-lg font-semibold mb-6 flex items-center gap-2 tracking-tight">
              <span className="material-symbols-outlined text-[#8b5cf6]">tune</span>
              Preferences
            </h4>
            <div className="space-y-6 flex-1">
              {[
                { key: 'emailNotifs', label: 'Email Notifications', desc: 'Updates on your bookings' },
                { key: 'smsReminders', label: 'SMS Reminders', desc: '1 hour before appointment' },
                { key: 'marketing', label: 'Marketing Updates', desc: 'Exclusive offers and deals' },
              ].map(pref => (
                <div key={pref.key} className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">{pref.label}</p>
                    <p className="text-xs text-text-secondary">{pref.desc}</p>
                  </div>
                  <button onClick={() => togglePreference(pref.key)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${preferences[pref.key] ? 'bg-brand-purple' : 'bg-background-dark border border-white/20'}`}>
                    <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${preferences[pref.key] ? 'translate-x-5' : ''}`}></div>
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-8 pt-6 border-t border-white/5">
              <button className="text-text-secondary hover:text-white text-sm font-medium transition-colors flex items-center gap-2">
                <span className="material-symbols-outlined text-base">lock</span>
                Change Password
              </button>
            </div>
          </section>
        </div>

        {/* Save Message */}
        {saveMessage && (
          <div className={`p-3 rounded-lg text-sm text-center ${
            saveMessage.startsWith('success') 
              ? 'bg-green-500/10 border border-green-500/30 text-green-400' 
              : 'bg-red-500/10 border border-red-500/30 text-red-400'
          }`}>
            {saveMessage.split(':')[1]}
          </div>
        )}
        
        <footer className="flex justify-end pt-4">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-8 py-3 bg-brand-purple hover:bg-[#8b5cf6] text-white font-bold rounded-xl transition-all shadow-[0_4px_15px_rgba(107,70,193,0.3)] hover:shadow-[0_4px_20px_rgba(107,70,193,0.5)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </footer>
      </div>
    </CustomerLayout>
  );
};

export default Profile;