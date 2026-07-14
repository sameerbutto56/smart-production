import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Lock, Plus, Pencil, Trash2, Clock, FileText, Eye, EyeOff, User, LogIn } from 'lucide-react';

const NotesPage = () => {
  const { user } = useAuth();
  const [step, setStep] = useState('select'); // select → password → authenticated
  const [employees, setEmployees] = useState([]);
  const [employeeName, setEmployeeName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingNote, setEditingNote] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/api/notes/employees').then(res => {
      setEmployees(res.data || []);
    }).catch(() => {
      setEmployees([]);
    });
  }, []);

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/notes', { params: { employeeName } });
      setNotes(res.data || []);
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (step === 'authenticated' && employeeName) fetchNotes();
  }, [step, employeeName]);

  const handleVerify = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const res = await api.post('/api/notes/verify-password', { employeeName, password });
      if (res.data?.success) {
        setStep('authenticated');
      }
    } catch (err) {
      setAuthError(err.response?.data?.message || 'Wrong password');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingNote('new');
    setTitle('');
    setContent('');
  };

  const handleEdit = (note) => {
    setEditingNote(note.id);
    setTitle(note.title);
    setContent(note.content);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingNote === 'new') {
        await api.post('/api/notes', { employeeName, title, content });
      } else {
        await api.put(`/api/notes/${editingNote}`, { employeeName, title, content });
      }
      setEditingNote(null);
      setTitle('');
      setContent('');
      await fetchNotes();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this note?')) return;
    try {
      await api.delete(`/api/notes/${id}`, { params: { employeeName } });
      if (editingNote === id) {
        setEditingNote(null);
        setTitle('');
        setContent('');
      }
      await fetchNotes();
    } catch {
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleBack = () => {
    setStep('select');
    setEmployeeName('');
    setPassword('');
    setAuthError('');
  };

  if (step === 'select') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
        <div className="bg-gray-800 rounded-xl p-8 w-full max-w-md shadow-2xl border border-gray-700">
          <div className="text-center mb-6">
            <div className="mx-auto w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mb-4">
              <User className="w-8 h-8 text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Personal Notes</h2>
            <p className="text-gray-400 text-sm mt-1">Select your name to continue</p>
          </div>

          <div className="space-y-2">
            {employees.map(name => (
              <button
                key={name}
                onClick={() => { setEmployeeName(name); setStep('password'); setPassword(''); setAuthError(''); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-700 hover:bg-gray-600 border border-gray-600 text-white transition-colors text-left"
              >
                <User size={18} className="text-gray-400 shrink-0" />
                <span>{name}</span>
              </button>
            ))}
          </div>

          {employees.length === 0 && (
            <p className="text-gray-400 text-center py-4">No employees available</p>
          )}
        </div>
      </div>
    );
  }

  if (step === 'password') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
        <div className="bg-gray-800 rounded-xl p-8 w-full max-w-md shadow-2xl border border-gray-700">
          <div className="text-center mb-6">
            <div className="mx-auto w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Welcome, {employeeName}</h2>
            <p className="text-gray-400 text-sm mt-1">Enter your password to access notes</p>
          </div>

          <form onSubmit={handleVerify}>
            <div className="relative mb-4">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                className="w-full px-4 py-3 pr-10 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {authError && (
              <p className="text-red-400 text-sm mb-4 text-center">{authError}</p>
            )}

            <button
              type="submit"
              disabled={!password || authLoading}
              className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium transition-colors"
            >
              {authLoading ? 'Verifying...' : 'Login'}
            </button>

            <button
              type="button"
              onClick={handleBack}
              className="w-full py-2 mt-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
            >
              Back
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white">My Notes</h1>
              <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-sm font-medium">{employeeName}</span>
            </div>
            <p className="text-gray-400 text-sm">{notes.length} note{notes.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex gap-2">
            {editingNote !== 'new' && (
              <button
                onClick={handleCreate}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
              >
                <Plus size={18} />
                New Note
              </button>
            )}
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
              title="Switch employee"
            >
              <LogIn size={18} />
            </button>
          </div>
        </div>

        {editingNote && (
          <div className="bg-gray-800 rounded-xl p-6 mb-6 border border-gray-700">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title (optional)"
              className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4 text-lg font-medium"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your note here..."
              rows={8}
              className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={!content.trim() || saving}
                className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white transition-colors"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => { setEditingNote(null); setTitle(''); setContent(''); }}
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
            <p className="text-gray-500 text-sm mt-1">Click "New Note" to create your first note</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {notes.map(note => (
              <div
                key={note.id}
                className={`bg-gray-800 rounded-xl p-5 border transition-colors ${
                  editingNote === note.id ? 'border-indigo-500' : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-semibold truncate">
                      {note.title || <span className="text-gray-500 italic">Untitled</span>}
                    </h3>
                    <p className="text-gray-300 mt-2 whitespace-pre-wrap break-words line-clamp-3">
                      {note.content || <span className="text-gray-500 italic">Empty</span>}
                    </p>
                    <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                      <Clock size={12} />
                      <span>Created {formatDateTime(note.createdAt)}</span>
                      {note.updatedAt !== note.createdAt && (
                        <>
                          <span className="text-gray-600">·</span>
                          <span>Updated {formatDateTime(note.updatedAt)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleEdit(note)}
                      className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                      title="Edit"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(note.id)}
                      className="p-2 rounded-lg bg-gray-700 hover:bg-red-600/30 text-gray-300 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
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
