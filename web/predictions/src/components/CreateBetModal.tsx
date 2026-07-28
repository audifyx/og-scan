'use client';
import { useState } from 'react';
import { X, Plus, Trash2, Users, ImagePlus } from 'lucide-react';
import { DURATIONS } from '@/lib/durations';

interface Props {
  onClose: () => void;
  onSubmit: (data: any) => void;
  isAdmin?: boolean;
}

export function CreateBetModal({ onClose, onSubmit, isAdmin }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('crypto');
  const [outcomes, setOutcomes] = useState(['Yes', 'No']);
  const [expiryMinutes, setExpiryMinutes] = useState(1440);
  const [minStake, setMinStake] = useState('0.1');
  const [maxParticipants, setMaxParticipants] = useState(15);
  const [featured, setFeatured] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const uploadImage = async (file: File) => {
    setUploading(true); setError('');
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await fetch('/api/upload-image', { method: 'POST', body: fd });
      const d = await r.json();
      if (d.ok) setImageUrl(d.url); else setError(d.error || 'Upload failed');
    } catch { setError('Upload failed'); } finally { setUploading(false); }
  };

  const addOutcome = () => {
    if (outcomes.length < 10) setOutcomes([...outcomes, '']);
  };
  const removeOutcome = (i: number) => {
    if (outcomes.length > 2) setOutcomes(outcomes.filter((_, idx) => idx !== i));
  };
  const updateOutcome = (i: number, v: string) => {
    const updated = [...outcomes]; updated[i] = v; setOutcomes(updated);
  };

  const handleSubmit = async () => {
    if (!title.trim() && !description.trim()) return setError('Enter a title or description');
    if (outcomes.some(o => !o.trim())) return setError('All outcome labels must be filled');
    if (maxParticipants < 2 || maxParticipants > 15) return setError('Participants must be 2–15');
    setLoading(true);
    try {
      await onSubmit({
        title: title.trim() || description.trim().slice(0, 60),
        description: description.trim() || title.trim(),
        category,
        outcomes,
        expiryMinutes,
        minStake: parseFloat(minStake) || 0.1,
        maxParticipants,
        featured,
        image_url: imageUrl,
      });
      onClose();
    } catch (e: any) { setError(e.message || 'Failed to create bet'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up my-auto">
        <div className="sticky top-0 bg-card flex items-center justify-between p-5 border-b border-white/8">
          <h2 className="font-bold text-white">{isAdmin ? '🎯 Create Admin Bet' : 'Create a Bet'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1"><X size={18}/></button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-widest mb-1.5 block">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Will BTC hit $120k by July?"
              className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-cyan/60 placeholder-gray-400" />
          </div>

          <div>
            <label className="text-xs text-gray-500 uppercase tracking-widest mb-1.5 block">Description (optional)</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              placeholder="Extra details about this bet..."
              className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-cyan/60 placeholder-gray-400 resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-widest mb-1.5 block">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-3 text-gray-900 text-sm focus:outline-none focus:border-cyan/60">
                {['crypto','trenches','politics','sports','stocks','memes','pop culture','entertainment','tech','custom'].map(c => (
                  <option key={c} value={c} className="bg-white text-gray-900 capitalize">{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-widest mb-1.5 block">Expires in</label>
              <select value={expiryMinutes} onChange={e => setExpiryMinutes(+e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-3 text-gray-900 text-sm focus:outline-none focus:border-cyan/60">
                {DURATIONS.map(d => (
                  <option key={d.m} value={d.m} className="bg-white text-gray-900">{d.l}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Outcomes */}
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-widest mb-1.5 block">
              Outcomes ({outcomes.length}/10)
            </label>
            <div className="space-y-2">
              {outcomes.map((o, i) => (
                <div key={i} className="flex gap-2">
                  <input value={o} onChange={e => updateOutcome(i, e.target.value)}
                    placeholder={`Outcome ${i + 1}`}
                    className="flex-1 bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-cyan/60 placeholder-gray-400" />
                  {outcomes.length > 2 && (
                    <button onClick={() => removeOutcome(i)} className="text-gray-600 hover:text-loss p-2">
                      <Trash2 size={14}/>
                    </button>
                  )}
                </div>
              ))}
              {outcomes.length < 10 && (
                <button onClick={addOutcome}
                  className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-white/10 rounded-xl text-gray-500 hover:text-cyan hover:border-cyan/30 text-xs transition-colors">
                  <Plus size={12}/> Add outcome
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-widest mb-1.5 block">Min Stake (SOL)</label>
              <input type="number" value={minStake} onChange={e => setMinStake(e.target.value)}
                step="0.01" min="0.01"
                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-3 text-gray-900 text-sm focus:outline-none focus:border-cyan/60" />
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-widest mb-1.5 block flex items-center gap-1.5">
                <Users size={11}/> Max Participants
              </label>
              <input type="number" value={maxParticipants} onChange={e => setMaxParticipants(+e.target.value)}
                min="2" max="15"
                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-3 text-gray-900 text-sm focus:outline-none focus:border-cyan/60" />
              <p className="text-xs text-gray-600 mt-1">Max: 15</p>
            </div>
          </div>

          {isAdmin && (
            <label className="flex items-center gap-3 cursor-pointer">
              <div className={`w-10 h-5 rounded-full transition-colors ${featured ? 'bg-cyan' : 'bg-white/10'}`}
                onClick={() => setFeatured(!featured)}>
                <div className={`w-4 h-4 bg-white rounded-full mt-0.5 transition-all ${featured ? 'ml-5.5' : 'ml-0.5'}`} />
              </div>
              <span className="text-sm text-gray-300">Featured bet</span>
            </label>
          )}

          <div>
            <label className="text-xs text-gray-500 uppercase tracking-widest mb-1.5 block">Image (optional)</label>
            <div className="flex items-center gap-3">
              {imageUrl
                ? <img src={imageUrl} alt="" className="w-24 h-14 object-cover rounded-lg border border-white/10" />
                : <div className="w-24 h-14 rounded-lg border border-dashed border-white/15 flex items-center justify-center text-gray-600"><ImagePlus size={16}/></div>}
              <label className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-200 text-sm cursor-pointer hover:bg-white/10">
                {uploading ? 'Uploading…' : 'Upload'}
                <input type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) uploadImage(file); }} />
              </label>
              {imageUrl && <button type="button" onClick={() => setImageUrl('')} className="text-xs text-loss">remove</button>}
            </div>
          </div>

          {error && <p className="text-loss text-xs">{error}</p>}

          <button onClick={handleSubmit} disabled={loading}
            className="w-full py-4 bg-sol-gradient text-black font-black rounded-xl neon-cyan hover:opacity-90 transition-opacity disabled:opacity-40 text-sm">
            {loading ? 'Creating...' : 'Create Bet'}
          </button>

          <p className="text-center text-xs text-gray-700">
            ⚠️ Once created, bets cannot be edited. Choose outcomes carefully.
          </p>
        </div>
      </div>
    </div>
  );
}
