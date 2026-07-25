import React, { useState } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';

const QUESTIONS = [
  'How satisfied are you with the overall quality of our medical scrubs and products?',
  'How satisfied are you with the fitting and comfort of the products you purchased?',
  'How would you rate the behavior and professionalism of our staff?',
  'How satisfied are you with the assistance provided by our sales team?',
  'How would you rate the cleanliness and ambience of the outlet?',
  'How satisfied are you with the product variety available at the outlet?',
  'How would you rate the speed of our customer service?',
  'How satisfied are you with your overall shopping experience at ENAMELS?',
  'Would you recommend ENAMELS to your friends or colleagues?',
  'Overall, how satisfied are you with your visit to our outlet?',
];

const RATING_LABELS = { 1: 'Excellent', 2: 'Good', 3: 'Average', 4: 'Poor', 5: 'Very Poor' };
const RATING_COLORS = { 1: '#10b981', 2: '#22d3ee', 3: '#fbbf24', 4: '#f97316', 5: '#ef4444' };

const StarRating = ({ value, onChange }) => (
  <div className="flex gap-2">
    {[1, 2, 3, 4, 5].map(n => (
      <button key={n} type="button" onClick={() => onChange(n)}
        className="w-11 h-11 sm:w-13 sm:h-13 rounded-xl font-black text-sm transition-all duration-200 flex items-center justify-center"
        style={{
          background: value === n ? RATING_COLORS[n] : 'rgba(255,255,255,0.06)',
          color: value === n ? '#fff' : value > n ? RATING_COLORS[n] : 'rgba(255,255,255,0.3)',
          borderWidth: value === n ? '2px' : '1px',
          borderColor: value === n ? RATING_COLORS[n] : 'rgba(255,255,255,0.1)',
          transform: value === n ? 'scale(1.1)' : 'scale(1)',
        }}>
        {n}
      </button>
    ))}
  </div>
);

const CustomerFeedbackForm = () => {
  const [form, setForm] = useState({
    fullName: '', mobileNumber: '', emailAddress: '', outlet: '',
    q1: 0, q2: 0, q3: 0, q4: 0, q5: 0, q6: 0, q7: 0, q8: 0, q9: 0, q10: 0,
    comments: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const allRated = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].every(i => form[`q${i}`] > 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fullName.trim()) return setError('Please enter your full name');
    if (!form.mobileNumber.trim()) return setError('Please enter your mobile number');
    if (!form.outlet) return setError('Please select your outlet');
    if (!allRated) return setError('Please rate all 10 questions');
    setError('');
    setSubmitting(true);
    try {
      await axios.post(`${API_BASE}/api/feedback`, form);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'linear-gradient(135deg, #020617 0%, #0f172a 50%, #030712 100%)' }}>
        <div className="text-center max-w-md mx-auto">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-3">Thank You!</h1>
          <p className="text-gray-400 font-bold text-lg mb-2">Your feedback has been submitted successfully.</p>
          <p className="text-gray-500 font-bold text-sm">Your opinion matters and helps us improve our products and services.</p>
          <button onClick={() => { setSubmitted(false); setForm({ fullName: '', mobileNumber: '', emailAddress: '', outlet: '', q1: 0, q2: 0, q3: 0, q4: 0, q5: 0, q6: 0, q7: 0, q8: 0, q9: 0, q10: 0, comments: '' }); }}
            className="mt-8 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-sm uppercase tracking-wider transition-all">
            Submit Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12" style={{ background: 'linear-gradient(135deg, #020617 0%, #0f172a 50%, #030712 100%)' }}>
      <div className="max-w-2xl mx-auto px-4 pt-8">
        {/* Header */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="ENAMELS" className="h-20 mx-auto mb-4" />
          <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">Give Your Feedback</h1>
          <p className="text-gray-400 font-bold text-sm sm:text-base">Your feedback helps us improve our products and services.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Info */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-black text-white uppercase tracking-widest mb-2">Your Information</h2>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Full Name *</label>
              <input type="text" value={form.fullName} onChange={e => updateField('fullName', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-sm outline-none focus:border-blue-500 transition-colors"
                placeholder="Enter your full name" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Mobile Number *</label>
                <input type="tel" value={form.mobileNumber} onChange={e => updateField('mobileNumber', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-sm outline-none focus:border-blue-500 transition-colors"
                  placeholder="03XX-XXXXXXX" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Email Address</label>
                <input type="email" value={form.emailAddress} onChange={e => updateField('emailAddress', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-sm outline-none focus:border-blue-500 transition-colors"
                  placeholder="Optional" />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Outlet Visited *</label>
              <div className="grid grid-cols-3 gap-3">
                {['Johar Town', 'Jail Road', 'Abbottabad'].map(outlet => (
                  <button key={outlet} type="button" onClick={() => updateField('outlet', outlet)}
                    className={`py-3 rounded-xl font-black text-xs sm:text-sm uppercase tracking-wider transition-all border ${
                      form.outlet === outlet
                        ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/30'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                    }`}>
                    {outlet}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Questions */}
          <div className="space-y-3">
            <h2 className="text-sm font-black text-white uppercase tracking-widest mb-1">Rate Your Experience</h2>
            <p className="text-gray-500 font-bold text-xs uppercase tracking-wider mb-4">1 = Excellent | 2 = Good | 3 = Average | 4 = Poor | 5 = Very Poor</p>
            {QUESTIONS.map((q, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-5">
                <p className="text-white font-bold text-sm mb-3">
                  <span className="text-blue-400 mr-2">{i + 1}.</span>{q}
                </p>
                <div className="flex items-center gap-3">
                  <StarRating value={form[`q${i + 1}`]} onChange={v => updateField(`q${i + 1}`, v)} />
                  {form[`q${i + 1}`] > 0 && (
                    <span className="text-xs font-black uppercase tracking-wider ml-2" style={{ color: RATING_COLORS[form[`q${i + 1}`]] }}>
                      {RATING_LABELS[form[`q${i + 1}`]]}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Comments */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <label className="text-xs font-black text-white uppercase tracking-widest mb-2 block">Additional Comments or Suggestions</label>
            <textarea value={form.comments} onChange={e => updateField('comments', e.target.value)}
              rows={4}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-sm outline-none focus:border-blue-500 transition-colors resize-none"
              placeholder="Share your compliments, suggestions, or complaints..." />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 font-black text-sm text-center">
              {error}
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={submitting}
            className="w-full py-4 rounded-2xl font-black text-base uppercase tracking-widest transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: '#fff' }}>
            {submitting ? 'Submitting...' : 'Submit Feedback'}
          </button>

          <p className="text-center text-gray-600 font-bold text-xs">This software is developed by Ismail Bhatt</p>
        </form>
      </div>
    </div>
  );
};

export default CustomerFeedbackForm;
