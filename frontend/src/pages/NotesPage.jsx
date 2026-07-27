import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Plus, X, Clock, User, FileText, Trash2 } from 'lucide-react';

const ROLE_TO_PROFILE = {
  SUPER_ADMIN: 'ADMIN',
  ADMIN: 'ADMIN',
  FAISAL: 'FAISAL',
  ORDER_ENTRY: 'ORDER_ENTRY',
  OUTLET: 'OUTLET',
  STORE: 'STORE',
  STORE_EMPLOYEE: 'STORE',
  PRODUCTION: 'PRODUCTION',
  PRODUCTION_IN: 'PRODUCTION',
  PRODUCTION_OUT: 'PRODUCTION',
  DISPATCH: 'DISPATCH',
  MAIN_EMPLOYEE: 'DISPATCH',
  DELIVERY_BOY: 'DELIVERY_BOY',
  LOGO_DESIGN: 'LOGO_DESIGN',
  LOGO_DESIGN_EMPLOYEE: 'LOGO_DESIGN',
  LOGO_DESIGNER: 'LOGO_DESIGN',
  INVENTORY_VIEW: 'ADMIN',
};

const NotesPage = () => {
  const { user } = useAuth();
  const profileType = ROLE_TO_PROFILE[user?.role] || user?.role || 'GENERAL';

  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [employeeName, setEmployeeName] = useState(user?.name || '');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/notes?profileType=${encodeURIComponent(profileType)}`);
      setNotes(res.data || []);
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotes(); }, [profileType]);

  const handleSave = async () => {
    if (!employeeName.trim() || !content.trim()) return;
    setSaving(true);
    try {
      await api.post('/api/notes', { employeeName: employeeName.trim(), content: content.trim(), profileType });
      setShowForm(false);
      setContent('');
      await fetchNotes();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const [deleting, setDeleting] = useState(null);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this note?')) return;
    setDeleting(id);
    try {
      await api.delete(`/api/notes/${id}`);
      await fetchNotes();
    } catch {
    } finally {
      setDeleting(null);
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const profileLabel = profileType || 'General';

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Notes — {profileLabel}</h1>
            <p className="text-gray-400 text-sm">{notes.length} note{notes.length !== 1 ? 's' : ''} • Private to {profileLabel}</p>
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            >
              <Plus size={18} />
              New Note
            </button>
          )}
        </div>

        {showForm && (
          <div className="bg-gray-800 rounded-xl p-6 mb-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">New Note</h2>
              <button onClick={() => { setShowForm(false); setContent(''); }} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="mb-3 px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
              <p className="text-xs font-black text-indigo-400 uppercase tracking-wider">Profile: {profileLabel}</p>
              <p className="text-[10px] text-gray-500 mt-1">This note will only be visible to {profileLabel} team members.</p>
            </div>
            <input
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              placeholder="Your name"
              className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your note here..."
              rows={6}
              className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={!employeeName.trim() || !content.trim() || saving}
                className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-colors"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => { setShowForm(false); setContent(''); }}
                className="px-6 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading notes...</div>
        ) : notes.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No notes yet</p>
            <p className="text-gray-500 text-sm mt-1">Click &quot;New Note&quot; to create the first note for {profileLabel}</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {notes.map(note => (
              <div key={note.id} className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <User size={14} className="text-gray-500 shrink-0" />
                      <span className="text-sm font-semibold text-indigo-400">{note.ownerName}</span>
                    </div>
                    <p className="text-gray-300 whitespace-pre-wrap break-words">
                      {note.content}
                    </p>
                    <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                      <Clock size={12} />
                      <span>{formatDateTime(note.createdAt)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(note.id)}
                    disabled={deleting === note.id}
                    className="text-gray-600 hover:text-red-400 transition-colors shrink-0 p-1"
                    title="Delete note"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotesPage;
