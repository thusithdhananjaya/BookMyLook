import React, { useState, useEffect, useRef } from 'react';
import { auth, db, storage } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import AdminLayout from './AdminLayout';

const AdminStaff = () => {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adminUid, setAdminUid] = useState(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const fileInputRef = useRef(null);

  // Fetch staff for this salon
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      setAdminUid(user.uid);
      const q = query(collection(db, 'staff'), where('salonId', '==', user.uid), orderBy('createdAt', 'desc'));
      const unsubSnapshot = onSnapshot(q, (snapshot) => {
        setStaff(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }, (err) => {
        console.error('Error fetching staff:', err);
        setLoading(false);
      });
      return () => unsubSnapshot();
    });
    return () => unsubAuth();
  }, []);

  const resetForm = () => {
    setFormName(''); setFormRole(''); setFormDescription('');
    setPhotoFile(null); setPhotoPreview(''); setFormError(''); setEditingStaff(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openAddModal = () => { resetForm(); setIsModalOpen(true); };

  const openEditModal = (member) => {
    setEditingStaff(member);
    setFormName(member.name);
    setFormRole(member.role);
    setFormDescription(member.description || '');
    setPhotoPreview(member.photoUrl || '');
    setPhotoFile(null);
    setFormError('');
    setIsModalOpen(true);
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setFormError('Please select an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { setFormError('Image must be smaller than 5MB.'); return; }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setFormError('');
  };

  const handleSave = async () => {
    setFormError('');
    if (!formName.trim()) { setFormError('Name is required.'); return; }
    if (!formRole.trim()) { setFormError('Role is required.'); return; }

    setIsSaving(true);
    try {
      let photoUrl = editingStaff?.photoUrl || '';

      // Upload photo if new file selected
      if (photoFile) {
        const timestamp = Date.now();
        const safeName = photoFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `staff/${adminUid}/${timestamp}_${safeName}`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, photoFile);
        photoUrl = await getDownloadURL(storageRef);

        const staffData = editingStaff ? { ...editingStaff } : {};
        // Store new storagePath for future deletion
        if (editingStaff) {
          await updateDoc(doc(db, 'staff', editingStaff.id), {
            name: formName.trim(), role: formRole.trim(), description: formDescription.trim(),
            photoUrl, storagePath,
          });
        } else {
          await addDoc(collection(db, 'staff'), {
            salonId: adminUid, name: formName.trim(), role: formRole.trim(),
            description: formDescription.trim(), photoUrl, storagePath, createdAt: serverTimestamp(),
          });
        }
      } else if (editingStaff) {
        await updateDoc(doc(db, 'staff', editingStaff.id), {
          name: formName.trim(), role: formRole.trim(), description: formDescription.trim(),
        });
      } else {
        await addDoc(collection(db, 'staff'), {
          salonId: adminUid, name: formName.trim(), role: formRole.trim(),
          description: formDescription.trim(), photoUrl: '', storagePath: '', createdAt: serverTimestamp(),
        });
      }

      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      console.error('Error saving staff:', err);
      setFormError('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (member) => {
    if (!window.confirm(`Remove "${member.name}" from staff?`)) return;
    setDeletingId(member.id);
    try {
      if (member.storagePath) {
        try { await deleteObject(ref(storage, member.storagePath)); } catch (e) { console.warn('Storage delete failed:', e); }
      }
      await deleteDoc(doc(db, 'staff', member.id));
    } catch (err) {
      console.error('Error deleting staff:', err);
      alert('Failed to delete staff member.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AdminLayout activePage="staff">
      <header className="h-20 px-8 flex items-center justify-between shrink-0 bg-background-dark/80 backdrop-blur-sm z-10 sticky top-0 border-b border-white/5">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Manage Staff</h2>
          <p className="text-text-secondary text-sm mt-0.5">{staff.length} team member{staff.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openAddModal} className="flex items-center gap-2 bg-primary hover:bg-primary-glow text-white font-semibold text-sm px-4 py-2.5 rounded-lg shadow-glow transition-all duration-300">
          <span className="material-symbols-outlined">person_add</span>Add Staff Member
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
            <p className="text-text-secondary text-sm">Loading staff...</p>
          </div>
        )}

        {!loading && staff.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <span className="material-symbols-outlined text-6xl text-text-secondary/30">groups</span>
            <h3 className="text-xl font-bold text-white">No Staff Members Yet</h3>
            <p className="text-text-secondary max-w-sm">Add your team members so customers can see who will be serving them.</p>
            <button onClick={openAddModal} className="mt-2 bg-primary hover:bg-primary-glow text-white px-6 py-2.5 rounded-lg text-sm font-bold transition-all shadow-glow">Add Your First Staff Member</button>
          </div>
        )}

        {!loading && staff.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {staff.map((member) => (
              <div key={member.id} className="bg-card-dark rounded-2xl p-6 border border-white/5 hover:border-primary/30 transition-all duration-200 flex flex-col items-center text-center group">
                <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-primary/30 mb-4">
                  {member.photoUrl ? (
                    <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-white/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-4xl text-text-secondary">person</span>
                    </div>
                  )}
                </div>
                <h4 className="font-bold text-lg text-white">{member.name}</h4>
                <p className="text-sm text-primary font-medium mt-1">{member.role}</p>
                {member.description && <p className="text-sm text-text-secondary mt-3 line-clamp-3">{member.description}</p>}
                <div className="flex items-center gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditModal(member)} className="p-2 rounded-lg text-text-secondary hover:bg-white/5 hover:text-white transition-colors" title="Edit">
                    <span className="material-symbols-outlined text-[20px]">edit</span>
                  </button>
                  <button onClick={() => handleDelete(member)} disabled={deletingId === member.id} className="p-2 rounded-lg text-text-secondary hover:bg-danger/10 hover:text-danger transition-colors disabled:opacity-50" title="Remove">
                    <span className="material-symbols-outlined text-[20px]">{deletingId === member.id ? 'hourglass_empty' : 'delete'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setIsModalOpen(false); resetForm(); }}></div>
          <div className="relative w-full max-w-md bg-card-dark border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
              <h3 className="text-white text-lg font-bold">{editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}</h3>
              <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="text-text-secondary hover:text-white transition-colors"><span className="material-symbols-outlined">close</span></button>
            </div>
            <div className="p-6 overflow-y-auto flex flex-col gap-5">
              {/* Photo */}
              <div className="flex flex-col items-center gap-3">
                <div onClick={() => fileInputRef.current?.click()} className="w-24 h-24 rounded-full bg-white/5 border-2 border-dashed border-white/20 flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary/50 transition-colors">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-3xl text-text-secondary">add_a_photo</span>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                <p className="text-xs text-text-secondary">Click to upload photo (optional)</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-white">Name *</label>
                <input value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full bg-background-dark border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder-text-secondary/50" placeholder="e.g., Sarah L." type="text" />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-white">Role *</label>
                <select value={formRole} onChange={(e) => setFormRole(e.target.value)} className="w-full bg-background-dark border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary">
                  <option value="" disabled>Select Role</option>
                  <option value="Senior Stylist">Senior Stylist</option>
                  <option value="Hair Stylist">Hair Stylist</option>
                  <option value="Barber Specialist">Barber Specialist</option>
                  <option value="Nail Artist">Nail Artist</option>
                  <option value="Esthetician">Esthetician</option>
                  <option value="Makeup Artist">Makeup Artist</option>
                  <option value="Massage Therapist">Massage Therapist</option>
                  <option value="Receptionist">Receptionist</option>
                  <option value="Manager">Manager</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-white">Bio (optional)</label>
                <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} className="w-full bg-background-dark border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder-text-secondary/50 resize-none" placeholder="Brief description of their expertise..." rows="3"></textarea>
              </div>

              {formError && <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-sm p-3 rounded-lg text-center">{formError}</div>}
            </div>
            <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3 bg-white/5">
              <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="px-4 py-2 rounded-lg text-sm font-medium text-white hover:bg-white/10 transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={isSaving} className="px-6 py-2 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary-glow shadow-glow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {isSaving ? 'Saving...' : (editingStaff ? 'Update' : 'Add Staff')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminStaff;