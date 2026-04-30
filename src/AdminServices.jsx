import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import AdminLayout from './AdminLayout';
import { formatLKR } from './utils/formatLKR';

const AdminServices = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adminUid, setAdminUid] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formDuration, setFormDuration] = useState(60);
  const [formDescription, setFormDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      setAdminUid(user.uid);
      const q = query(collection(db, 'services'), where('salonId', '==', user.uid), orderBy('createdAt', 'desc'));
      const unsubSnapshot = onSnapshot(q, (snapshot) => {
        setServices(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }, (err) => { console.error('Error fetching services:', err); setLoading(false); });
      return () => unsubSnapshot();
    });
    return () => unsubAuth();
  }, []);

  const resetForm = () => { setFormName(''); setFormCategory(''); setFormPrice(''); setFormDuration(60); setFormDescription(''); setFormError(''); setEditingService(null); };
  const openAddModal = () => { resetForm(); setIsModalOpen(true); };
  const openEditModal = (s) => { setEditingService(s); setFormName(s.name); setFormCategory(s.category); setFormPrice(String(s.price)); setFormDuration(s.duration); setFormDescription(s.description || ''); setFormError(''); setIsModalOpen(true); };

  const handleSave = async () => {
    setFormError('');
    if (!formName.trim()) { setFormError('Service name is required.'); return; }
    if (!formCategory) { setFormError('Please select a category.'); return; }
    if (!formPrice || isNaN(formPrice) || Number(formPrice) <= 0) { setFormError('Please enter a valid price.'); return; }
    setIsSaving(true);
    try {
      const data = { name: formName.trim(), category: formCategory, price: Number(formPrice), duration: Number(formDuration), description: formDescription.trim() };
      if (editingService) {
        await updateDoc(doc(db, 'services', editingService.id), data);
      } else {
        await addDoc(collection(db, 'services'), { ...data, salonId: adminUid, isActive: true, createdAt: serverTimestamp() });
      }
      setIsModalOpen(false); resetForm();
    } catch (err) { console.error('Error saving service:', err); setFormError('Failed to save. Please try again.'); } finally { setIsSaving(false); }
  };

  const handleToggle = async (s) => { try { await updateDoc(doc(db, 'services', s.id), { isActive: !s.isActive }); } catch (err) { console.error('Toggle error:', err); } };
  const handleDelete = async (id) => { setDeletingId(id); try { await deleteDoc(doc(db, 'services', id)); } catch (err) { console.error('Delete error:', err); alert('Failed to delete.'); } finally { setDeletingId(null); } };
  const fmtDur = (m) => m < 60 ? `${m} min` : (m % 60 > 0 ? `${Math.floor(m/60)} hr ${m%60} min` : `${m/60} hr`);

  return (
    <AdminLayout activePage="services">
      <header className="h-20 px-8 flex items-center justify-between shrink-0 bg-background-dark/80 backdrop-blur-sm z-10 sticky top-0 border-b border-white/5">
        <div><h2 className="text-2xl font-bold text-white tracking-tight">Service Menu</h2><p className="text-text-secondary text-sm mt-0.5">{services.length} service{services.length !== 1 ? 's' : ''} listed</p></div>
        <button onClick={openAddModal} className="flex items-center gap-2 bg-primary hover:bg-primary-glow text-white font-semibold text-sm px-4 py-2.5 rounded-lg shadow-glow transition-all duration-300"><span className="material-symbols-outlined">add</span>Add New Service</button>
      </header>
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        {loading && (<div className="flex flex-col items-center justify-center py-20 gap-4"><div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div><p className="text-text-secondary text-sm">Loading services...</p></div>)}
        {!loading && services.length === 0 && (<div className="flex flex-col items-center justify-center py-20 gap-4 text-center"><span className="material-symbols-outlined text-6xl text-text-secondary/30">content_cut</span><h3 className="text-xl font-bold text-white">No Services Yet</h3><p className="text-text-secondary max-w-sm">Add your first service to start accepting bookings.</p><button onClick={openAddModal} className="mt-2 bg-primary hover:bg-primary-glow text-white px-6 py-2.5 rounded-lg text-sm font-bold transition-all shadow-glow">Add Your First Service</button></div>)}
        {!loading && services.length > 0 && (
          <div className="bg-card-dark border border-white/5 rounded-2xl overflow-hidden shadow-xl ring-1 ring-white/5"><div className="overflow-x-auto"><table className="w-full text-left border-collapse"><thead><tr className="bg-white/5 text-text-secondary text-xs uppercase tracking-wider font-semibold border-b border-white/5"><th className="p-4 pl-6">Service Name</th><th className="p-4">Category</th><th className="p-4">Price</th><th className="p-4">Duration</th><th className="p-4">Status</th><th className="p-4 pr-6 text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-white/5">{services.map((s) => (
              <tr key={s.id} className="group hover:bg-white/5 transition-colors">
                <td className="p-4 pl-6"><p className="text-sm font-medium text-white">{s.name}</p>{s.description && <p className="text-xs text-text-secondary mt-0.5 max-w-[250px] truncate">{s.description}</p>}</td>
                <td className="p-4"><span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20">{s.category}</span></td>
                <td className="p-4 text-sm font-medium text-white">{formatLKR(s.price)}</td>
                <td className="p-4 text-sm text-text-secondary"><div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[16px]">schedule</span>{fmtDur(s.duration)}</div></td>
                <td className="p-4"><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" checked={s.isActive} onChange={() => handleToggle(s)}/><div className="w-11 h-6 bg-white/10 rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div></label></td>
                <td className="p-4 pr-6 text-right"><div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity"><button onClick={() => openEditModal(s)} className="p-2 rounded-lg text-text-secondary hover:bg-white/5 hover:text-white transition-colors" title="Edit"><span className="material-symbols-outlined text-[20px]">edit</span></button><button onClick={() => handleDelete(s.id)} disabled={deletingId === s.id} className="p-2 rounded-lg text-text-secondary hover:bg-danger/10 hover:text-danger transition-colors disabled:opacity-50" title="Delete"><span className="material-symbols-outlined text-[20px]">{deletingId === s.id ? 'hourglass_empty' : 'delete'}</span></button></div></td>
              </tr>
            ))}</tbody></table></div></div>
        )}
      </div>
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setIsModalOpen(false); resetForm(); }}></div>
          <div className="relative w-full max-w-lg bg-card-dark border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5"><h3 className="text-white text-lg font-bold">{editingService ? 'Edit Service' : 'Add New Service'}</h3><button onClick={() => { setIsModalOpen(false); resetForm(); }} className="text-text-secondary hover:text-white transition-colors"><span className="material-symbols-outlined">close</span></button></div>
            <div className="p-6 overflow-y-auto flex flex-col gap-5">
              <div className="flex flex-col gap-1.5"><label className="text-sm font-medium text-white">Service Name *</label><input value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full bg-background-dark border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder-text-secondary/50" placeholder="e.g., Luxury Facial" type="text"/></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5"><label className="text-sm font-medium text-white">Category *</label><select value={formCategory} onChange={(e) => setFormCategory(e.target.value)} className="w-full bg-background-dark border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"><option value="" disabled>Select Category</option><option value="Hair">Hair</option><option value="Nails">Nails</option><option value="Skincare">Skincare</option><option value="Body">Body</option><option value="Makeup">Makeup</option></select></div>
                <div className="flex flex-col gap-1.5"><label className="text-sm font-medium text-white">Price (LKR) *</label><input value={formPrice} onChange={(e) => setFormPrice(e.target.value)} className="w-full bg-background-dark border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder-text-secondary/50" placeholder="e.g., 3500" type="number"/></div>
              </div>
              <div className="flex flex-col gap-1.5"><label className="text-sm font-medium text-white">Duration: {formDuration} min</label><input type="range" min="15" max="240" step="15" value={formDuration} onChange={(e) => setFormDuration(Number(e.target.value))} className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"/><div className="flex justify-between text-xs text-text-secondary"><span>15 min</span><span>4 hrs</span></div></div>
              <div className="flex flex-col gap-1.5"><label className="text-sm font-medium text-white">Description (optional)</label><textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} className="w-full bg-background-dark border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder-text-secondary/50 resize-none" placeholder="Brief description..." rows="3"></textarea></div>
              {formError && <div className="bg-red-500/10 border border-red-500/50 text-red-400 text-sm p-3 rounded-lg text-center">{formError}</div>}
            </div>
            <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3 bg-white/5"><button onClick={() => { setIsModalOpen(false); resetForm(); }} className="px-4 py-2 rounded-lg text-sm font-medium text-white hover:bg-white/10 transition-colors">Cancel</button><button onClick={handleSave} disabled={isSaving} className="px-6 py-2 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary-glow shadow-glow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed">{isSaving ? 'Saving...' : (editingService ? 'Update Service' : 'Save Service')}</button></div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};
export default AdminServices;