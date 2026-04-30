import React, { useState, useEffect, useRef } from 'react';
import { auth, db, storage } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import AdminLayout from './AdminLayout';

const AdminLookbook = () => {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adminUid, setAdminUid] = useState(null);
  const [activeFilter, setActiveFilter] = useState('All');

  // Upload modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState(null);
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const fileInputRef = useRef(null);

  // Fetch lookbook photos for this salon
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      setAdminUid(user.uid);

      const q = query(
        collection(db, 'lookbook'),
        where('salonId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );

      const unsubSnapshot = onSnapshot(q, (snapshot) => {
        setPhotos(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }, (err) => {
        console.error('Error fetching lookbook:', err);
        setLoading(false);
      });

      return () => unsubSnapshot();
    });
    return () => unsubAuth();
  }, []);

  // Derive unique categories from data
  const categories = ['All', ...new Set(photos.map(p => p.category).filter(Boolean))];
  const filteredPhotos = activeFilter === 'All' ? photos : photos.filter(p => p.category === activeFilter);

  // Reset form
  const resetForm = () => {
    setFormTitle('');
    setFormCategory('');
    setSelectedFile(null);
    setPreviewUrl('');
    setFormError('');
    setEditingPhoto(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Open upload modal
  const openUploadModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  // Open edit modal (metadata only — can't change the image)
  const openEditModal = (photo) => {
    setEditingPhoto(photo);
    setFormTitle(photo.title);
    setFormCategory(photo.category);
    setPreviewUrl(photo.imageUrl);
    setSelectedFile(null);
    setFormError('');
    setIsModalOpen(true);
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setFormError('Please select an image file (JPG, PNG, WEBP).');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setFormError('Image must be smaller than 5MB.');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setFormError('');
  };

  // Save (upload new or update metadata)
  const handleSave = async () => {
    setFormError('');
    if (!formTitle.trim()) { setFormError('Please enter a title.'); return; }
    if (!formCategory.trim()) { setFormError('Please select a category.'); return; }
    if (!editingPhoto && !selectedFile) { setFormError('Please select an image to upload.'); return; }

    setIsSaving(true);
    try {
      if (editingPhoto) {
        // Update metadata only
        await updateDoc(doc(db, 'lookbook', editingPhoto.id), {
          title: formTitle.trim(),
          category: formCategory.trim(),
        });
      } else {
        // Upload new photo to Firebase Storage
        const timestamp = Date.now();
        const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `lookbook/${adminUid}/${timestamp}_${safeName}`;
        const storageRef = ref(storage, storagePath);

        await uploadBytes(storageRef, selectedFile);
        const imageUrl = await getDownloadURL(storageRef);

        // Save metadata to Firestore
        await addDoc(collection(db, 'lookbook'), {
          salonId: adminUid,
          title: formTitle.trim(),
          category: formCategory.trim(),
          imageUrl: imageUrl,
          storagePath: storagePath,
          createdAt: serverTimestamp(),
        });
      }

      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      console.error('Error saving lookbook photo:', err);
      setFormError('Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete photo (from both Storage and Firestore)
  const handleDelete = async (photo) => {
    if (!window.confirm(`Delete "${photo.title}"? This cannot be undone.`)) return;

    setDeletingId(photo.id);
    try {
      // Delete from Storage
      if (photo.storagePath) {
        try {
          const storageRef = ref(storage, photo.storagePath);
          await deleteObject(storageRef);
        } catch (storageErr) {
          // Storage file might already be deleted — continue with Firestore cleanup
          console.warn('Storage delete failed (may already be deleted):', storageErr);
        }
      }

      // Delete from Firestore
      await deleteDoc(doc(db, 'lookbook', photo.id));
    } catch (err) {
      console.error('Error deleting photo:', err);
      alert('Failed to delete photo. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AdminLayout activePage="lookbook">
      <header className="h-20 px-8 flex items-center justify-between shrink-0 bg-background-dark/80 backdrop-blur-sm z-10 sticky top-0 border-b border-white/5">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Manage Lookbook</h2>
          <p className="text-text-secondary text-sm mt-0.5">{photos.length} photo{photos.length !== 1 ? 's' : ''} in your portfolio</p>
        </div>
        <button onClick={openUploadModal} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary-glow shadow-glow transition-all duration-300 text-white font-semibold text-sm">
          <span className="material-symbols-outlined text-base">upload</span>
          Upload New Photo
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">

        {/* Category Filters */}
        {!loading && photos.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveFilter(cat)}
                className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${
                  activeFilter === cat
                    ? 'bg-primary/20 text-white border border-primary/50 shadow-glow'
                    : 'bg-card-dark text-text-secondary hover:bg-white/5 hover:text-white border border-transparent'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
            <p className="text-text-secondary text-sm">Loading lookbook...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && photos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <span className="material-symbols-outlined text-6xl text-text-secondary/30">photo_library</span>
            <h3 className="text-xl font-bold text-white">No Photos Yet</h3>
            <p className="text-text-secondary max-w-sm">Upload your first portfolio photo to showcase your salon's best work to potential customers.</p>
            <button onClick={openUploadModal} className="mt-2 bg-primary hover:bg-primary-glow text-white px-6 py-2.5 rounded-lg text-sm font-bold transition-all shadow-glow">
              Upload Your First Photo
            </button>
          </div>
        )}

        {/* Masonry Grid */}
        {!loading && filteredPhotos.length > 0 && (
          <div className="masonry-grid">
            {filteredPhotos.map((photo) => (
              <div key={photo.id} className="masonry-item group relative cursor-pointer overflow-hidden rounded-xl">
                <img
                  src={photo.imageUrl}
                  alt={photo.title}
                  className="w-full h-auto object-cover rounded-xl transition-transform duration-300 group-hover:scale-105"
                />
                {/* Hover Overlay with Actions */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl flex items-center justify-center gap-4 border-2 border-transparent group-hover:border-primary group-hover:shadow-glow">
                  <button
                    onClick={() => openEditModal(photo)}
                    className="p-3 bg-white/10 rounded-full text-white hover:bg-primary backdrop-blur-sm transition-colors"
                  >
                    <span className="material-symbols-outlined">edit</span>
                  </button>
                  <button
                    onClick={() => handleDelete(photo)}
                    disabled={deletingId === photo.id}
                    className="p-3 bg-white/10 rounded-full text-white hover:bg-danger backdrop-blur-sm transition-colors disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined">{deletingId === photo.id ? 'hourglass_empty' : 'delete'}</span>
                  </button>
                </div>
                {/* Bottom Label */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent rounded-b-xl pointer-events-none">
                  <p className="text-sm font-semibold text-white">{photo.title}</p>
                  <p className="text-xs text-text-secondary/80 mt-1">#{photo.category}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No results for filter */}
        {!loading && photos.length > 0 && filteredPhotos.length === 0 && (
          <div className="text-center py-10 text-text-secondary">No photos found in "{activeFilter}" category.</div>
        )}
      </div>

      {/* Upload/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setIsModalOpen(false); resetForm(); }}></div>
          <div className="relative w-full max-w-lg bg-card-dark border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
              <h3 className="text-white text-lg font-bold">{editingPhoto ? 'Edit Photo Details' : 'Upload New Photo'}</h3>
              <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="text-text-secondary hover:text-white transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex flex-col gap-5">

              {/* File Upload (only for new uploads) */}
              {!editingPhoto && (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-white">Photo *</label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-white/20 rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
                  >
                    {previewUrl ? (
                      <img src={previewUrl} alt="Preview" className="max-h-48 mx-auto rounded-lg object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-text-secondary">
                        <span className="material-symbols-outlined text-4xl">cloud_upload</span>
                        <p className="text-sm">Click to select an image</p>
                        <p className="text-xs">JPG, PNG, WEBP — max 5MB</p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  {selectedFile && (
                    <p className="text-xs text-text-secondary mt-1">
                      Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(1)}MB)
                    </p>
                  )}
                </div>
              )}

              {/* Preview for edit mode */}
              {editingPhoto && previewUrl && (
                <div className="rounded-xl overflow-hidden border border-white/10">
                  <img src={previewUrl} alt="Current" className="w-full max-h-48 object-cover" />
                </div>
              )}

              {/* Title */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-white">Title *</label>
                <input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-background-dark border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder-text-secondary/50"
                  placeholder="e.g., Blonde Balayage"
                  type="text"
                />
              </div>

              {/* Category */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-white">Category *</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full bg-background-dark border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option value="" disabled>Select Category</option>
                  <option value="Haircuts">Haircuts</option>
                  <option value="Coloring">Coloring</option>
                  <option value="Nails">Nails</option>
                  <option value="Bridal">Bridal</option>
                  <option value="Skincare">Skincare</option>
                  <option value="Makeup">Makeup</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Error */}
              {formError && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-sm p-3 rounded-lg text-center">{formError}</div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3 bg-white/5">
              <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="px-4 py-2 rounded-lg text-sm font-medium text-white hover:bg-white/10 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-2 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary-glow shadow-glow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (editingPhoto ? 'Updating...' : 'Uploading...') : (editingPhoto ? 'Update Details' : 'Upload Photo')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminLookbook;