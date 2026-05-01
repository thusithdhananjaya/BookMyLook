import React, { useState, useEffect, useRef } from 'react';
import { auth, db, storage } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import AdminLayout from './AdminLayout';

const AdminSettings = () => {
  const [activeTab, setActiveTab] = useState('General Profile');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [adminUid, setAdminUid] = useState(null);
  const fileInputRef = useRef(null);

  // General Profile state
  const [salonName, setSalonName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [salonAddress, setSalonAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [aboutSalon, setAboutSalon] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');

  // Business Hours state
  const [hours, setHours] = useState({
    monFriOpen: '09:00',
    monFriClose: '18:00',
    satOpen: '09:00',
    satClose: '17:00',
    sunClosed: true,
    sunOpen: '10:00',
    sunClose: '14:00',
  });

  // Load salon data on mount
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      setAdminUid(user.uid);
      try {
        const docSnap = await getDoc(doc(db, 'users', user.uid));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSalonName(data.salonName || '');
          setContactPhone(data.contactPhone || '');
          setContactEmail(data.email || '');
          setSalonAddress(data.salonAddress || '');
          setLatitude(data.latitude || '');
          setLongitude(data.longitude || '');
          setAboutSalon(data.aboutSalon || '');
          setLogoUrl(data.logoUrl || '');

          if (data.operatingHours) {
            setHours({
              monFriOpen: data.operatingHours.monFriOpen || data.operatingHours.open || '09:00',
              monFriClose: data.operatingHours.monFriClose || data.operatingHours.close || '18:00',
              satOpen: data.operatingHours.satOpen || '09:00',
              satClose: data.operatingHours.satClose || '17:00',
              sunClosed: data.operatingHours.sunClosed ?? true,
              sunOpen: data.operatingHours.sunOpen || '10:00',
              sunClose: data.operatingHours.sunClose || '14:00',
            });
          }
        }
      } catch (err) {
        console.error('Error loading settings:', err);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubAuth();
  }, []);

  // Handle logo file selection
  const handleLogoSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setSaveMessage('error:Please select an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { setSaveMessage('error:Image must be smaller than 5MB.'); return; }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setSaveMessage('');
  };

  // Save all settings
  const handleSave = async () => {
    if (!salonName.trim()) { setSaveMessage('error:Salon name is required.'); return; }
    setIsSaving(true);
    setSaveMessage('');

    try {
      const updateData = {
        salonName: salonName.trim(),
        contactPhone: contactPhone.trim(),
        salonAddress: salonAddress.trim(),
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        aboutSalon: aboutSalon.trim(),
        operatingHours: {
          monFriOpen: hours.monFriOpen,
          monFriClose: hours.monFriClose,
          satOpen: hours.satOpen,
          satClose: hours.satClose,
          sunClosed: hours.sunClosed,
          sunOpen: hours.sunOpen,
          sunClose: hours.sunClose,
        },
      };

      // Upload new logo if selected
      if (logoFile) {
        const storagePath = `logos/${adminUid}`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, logoFile);
        const newLogoUrl = await getDownloadURL(storageRef);
        updateData.logoUrl = newLogoUrl;
        setLogoUrl(newLogoUrl);
        setLogoFile(null);
        setLogoPreview('');
      }

      await updateDoc(doc(db, 'users', adminUid), updateData);
      setSaveMessage('success:Settings saved successfully!');
    } catch (err) {
      console.error('Error saving settings:', err);
      setSaveMessage('error:Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass = "block w-full rounded-lg border border-white/10 bg-white/5 py-2.5 px-3 text-white placeholder:text-text-secondary/50 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors";

  if (loading) {
    return (
      <AdminLayout activePage="settings">
        <div className="flex items-center justify-center h-full">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activePage="settings">
      <header className="h-20 px-8 flex items-center justify-between shrink-0 bg-background-dark/80 backdrop-blur-sm z-10 sticky top-0 border-b border-white/5">
        <div><h2 className="text-2xl font-bold text-white tracking-tight">Salon Settings</h2></div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 pt-6 custom-scrollbar">
        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-4">
          {['General Profile', 'Business Hours', 'Account & Security'].map((tab) => (
            <button key={tab} onClick={() => { setActiveTab(tab); setSaveMessage(''); }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === tab ? 'bg-primary/20 text-white shadow-glow border border-primary/50' : 'text-text-secondary hover:bg-white/5 hover:text-white border border-transparent'}`}>
              {tab}
            </button>
          ))}
        </div>

        <div className="mt-8 flex flex-col">
          <div className="bg-card-dark border border-white/5 rounded-2xl p-8">

            {/* GENERAL PROFILE TAB */}
            {activeTab === 'General Profile' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-8 animate-fade-in">
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-white tracking-tight">Basic Information</h3>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Salon Name *</label>
                    <input value={salonName} onChange={(e) => { setSalonName(e.target.value); setSaveMessage(''); }} className={inputClass} placeholder="e.g., Elegance Hair & Beauty" type="text" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Phone Number</label>
                    <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inputClass} placeholder="+94 7X XXX XXXX" type="tel" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Email Address</label>
                    <input value={contactEmail} disabled className="block w-full rounded-lg border border-white/10 bg-white/5 py-2.5 px-3 text-white/50 outline-none cursor-not-allowed" type="email" />
                    <p className="text-xs text-text-secondary mt-1">Email is set during registration.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Full Address</label>
                    <textarea value={salonAddress} onChange={(e) => setSalonAddress(e.target.value)} className={`${inputClass} resize-none`} placeholder="Enter your salon's full physical address" rows="3"></textarea>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">Latitude</label>
                      <input value={latitude} onChange={(e) => setLatitude(e.target.value)} className={inputClass} placeholder="e.g., 6.9271" type="number" step="any" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-2">Longitude</label>
                      <input value={longitude} onChange={(e) => setLongitude(e.target.value)} className={inputClass} placeholder="e.g., 79.8612" type="number" step="any" />
                    </div>
                  </div>
                  <p className="text-xs text-text-secondary -mt-3">Right-click your location on <a href="https://www.google.com/maps" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary-glow underline">Google Maps</a> to copy coordinates.</p>
                </div>
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-white tracking-tight">Visual Identity</h3>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">Salon Logo</label>
                    <div className="flex items-center gap-6">
                      <div className="w-32 h-32 rounded-full bg-white/5 border-2 border-dashed border-white/20 flex items-center justify-center text-text-secondary overflow-hidden">
                        {(logoPreview || logoUrl) ? (
                          <img src={logoPreview || logoUrl} alt="Logo" className="w-full h-full object-cover" />
                        ) : (
                          <span className="material-symbols-outlined text-4xl">photo_camera</span>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <p className="text-sm text-text-secondary">Upload a logo (PNG, JPG). Max 5MB.</p>
                        <button onClick={() => fileInputRef.current?.click()}
                          className="w-fit px-4 py-2 text-sm font-semibold rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors cursor-pointer">
                          {logoUrl ? 'Change Logo' : 'Upload Logo'}
                        </button>
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
                        {logoFile && <p className="text-xs text-success">New logo selected — click Save to apply.</p>}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">About Us Description</label>
                    <textarea value={aboutSalon} onChange={(e) => setAboutSalon(e.target.value)} className={`${inputClass} resize-none`} placeholder="Tell customers about your salon's story and what makes it special..." rows="6"></textarea>
                  </div>
                </div>
              </div>
            )}

            {/* BUSINESS HOURS TAB */}
            {activeTab === 'Business Hours' && (
              <div className="max-w-lg space-y-6 animate-fade-in">
                <h3 className="text-lg font-semibold text-white tracking-tight">Operating Hours</h3>

                {/* Monday-Friday */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-secondary">Monday — Friday</label>
                  <div className="flex items-center gap-3">
                    <input type="time" value={hours.monFriOpen} onChange={(e) => setHours({ ...hours, monFriOpen: e.target.value })} className={`${inputClass} w-36`} />
                    <span className="text-text-secondary">to</span>
                    <input type="time" value={hours.monFriClose} onChange={(e) => setHours({ ...hours, monFriClose: e.target.value })} className={`${inputClass} w-36`} />
                  </div>
                </div>

                {/* Saturday */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-text-secondary">Saturday</label>
                  <div className="flex items-center gap-3">
                    <input type="time" value={hours.satOpen} onChange={(e) => setHours({ ...hours, satOpen: e.target.value })} className={`${inputClass} w-36`} />
                    <span className="text-text-secondary">to</span>
                    <input type="time" value={hours.satClose} onChange={(e) => setHours({ ...hours, satClose: e.target.value })} className={`${inputClass} w-36`} />
                  </div>
                </div>

                {/* Sunday */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-text-secondary">Sunday</label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-secondary">Closed</span>
                      <button onClick={() => setHours({ ...hours, sunClosed: !hours.sunClosed })}
                        className={`w-11 h-6 rounded-full transition-colors relative ${hours.sunClosed ? 'bg-danger' : 'bg-success'}`}>
                        <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${hours.sunClosed ? '' : 'translate-x-5'}`}></div>
                      </button>
                      <span className="text-xs text-text-secondary">Open</span>
                    </div>
                  </div>
                  {!hours.sunClosed && (
                    <div className="flex items-center gap-3">
                      <input type="time" value={hours.sunOpen} onChange={(e) => setHours({ ...hours, sunOpen: e.target.value })} className={`${inputClass} w-36`} />
                      <span className="text-text-secondary">to</span>
                      <input type="time" value={hours.sunClose} onChange={(e) => setHours({ ...hours, sunClose: e.target.value })} className={`${inputClass} w-36`} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ACCOUNT & SECURITY TAB */}
            {activeTab === 'Account & Security' && (
              <div className="max-w-lg space-y-6 animate-fade-in">
                <h3 className="text-lg font-semibold text-white tracking-tight">Account Security</h3>
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">Password</p>
                      <p className="text-xs text-text-secondary">Last changed: Unknown</p>
                    </div>
                    <button className="px-4 py-2 text-sm font-semibold rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors">
                      Change Password
                    </button>
                  </div>
                </div>
                <div className="bg-danger/10 p-4 rounded-xl border border-danger/20">
                  <h4 className="text-danger font-semibold text-sm">Danger Zone</h4>
                  <p className="text-xs text-text-secondary mt-1">Deleting your account is permanent and cannot be undone.</p>
                  <button className="mt-3 px-4 py-2 text-sm font-semibold rounded-lg bg-danger/20 border border-danger/30 text-danger hover:bg-danger/30 transition-colors">
                    Delete Account
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Save Message */}
          {saveMessage && (
            <div className={`mt-4 p-3 rounded-lg text-sm text-center ${
              saveMessage.startsWith('success')
                ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}>
              {saveMessage.split(':')[1]}
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-6 pt-6 border-t border-white/5 flex justify-end gap-4">
            <button onClick={() => window.location.reload()} className="px-6 py-2.5 rounded-lg text-sm font-semibold text-text-secondary hover:text-white border border-white/20 hover:border-white/40 transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={isSaving}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-primary-glow shadow-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;