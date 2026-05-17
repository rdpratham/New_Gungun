import { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function CampaignsPage({ user, employees }) {
  const [tab, setTab]                   = useState('create');
  const [campaigns, setCampaigns]       = useState([]);
  const [name, setName]                 = useState('');
  const [saving, setSaving]             = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [assigning, setAssigning]       = useState(null);
  const [successMsg, setSuccessMsg]     = useState('');

  useEffect(() => {
    return onSnapshot(collection(db, 'campaigns'), snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
      setCampaigns(list);
    });
  }, []);

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'campaigns'), {
        name: name.trim(),
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      });
      setName('');
      showSuccess('Campaign created successfully!');
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const handleAssign = async (empId, empName) => {
    if (!selectedCampaign) return;
    const campaign = campaigns.find(c => c.id === selectedCampaign);
    if (!campaign) return;
    setAssigning(empId);
    try {
      await updateDoc(doc(db, 'employees', empId), {
        campaign: { id: campaign.id, name: campaign.name, assignedAt: new Date() },
      });
      showSuccess(`Campaign "${campaign.name}" assigned to ${empName}!`);
    } catch (err) { console.error(err); }
    setAssigning(null);
  };

  const handleUnassign = async (empId, empName) => {
    setAssigning(empId);
    try {
      await updateDoc(doc(db, 'employees', empId), { campaign: null });
      showSuccess(`Campaign removed from ${empName}.`);
    } catch (err) { console.error(err); }
    setAssigning(null);
  };

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="relative rounded-3xl overflow-hidden p-6"
           style={{ background: 'linear-gradient(135deg,#7c3aed 0%,#3b82f6 60%,#06b6d4 100%)' }}>
        <div className="absolute inset-0 opacity-10"
             style={{ backgroundImage: 'radial-gradient(circle at 85% 50%, #fff 0%, transparent 55%)' }} />
        <div className="relative flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-black text-white">Campaigns</h1>
            <p className="text-white/60 text-xs mt-0.5">Create campaigns and assign them to employees</p>
          </div>
        </div>
      </div>

      {/* Success toast */}
      {successMsg && (
        <div className="px-4 py-3 rounded-xl text-sm font-semibold animate-fade-in"
             style={{ background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)' }}>
          ✓ {successMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)', width: 'fit-content' }}>
        {[['create', 'Create Campaign'], ['assign', 'Assign Campaign']].map(([t, lbl]) => (
          <button key={t} onClick={() => setTab(t)}
                  className="px-5 py-2 text-sm font-semibold transition-all"
                  style={tab === t
                    ? { background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', color: '#fff' }
                    : { background: 'var(--surface-s)', color: 'var(--text-3)' }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* ── Create Campaign ── */}
      {tab === 'create' && (
        <div className="space-y-4">
          <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h3 className="font-semibold" style={{ color: 'var(--text)', fontSize: 14 }}>New Campaign</h3>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-3)' }}>Campaign Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  placeholder="e.g. Q2 Sales Drive"
                  className="input-field w-full"
                />
              </div>
              <button
                onClick={handleCreate}
                disabled={saving || !name.trim()}
                className="btn-primary px-6"
                style={{ opacity: saving || !name.trim() ? 0.6 : 1, paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
                {saving ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>

          {campaigns.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="px-4 py-2.5 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface-s)' }}>
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
                  All Campaigns ({campaigns.length})
                </span>
              </div>
              <div>
                {campaigns.map(c => (
                  <div key={c.id} className="px-4 py-3.5 border-b last:border-b-0 flex items-center gap-3 transition-colors"
                       style={{ borderColor: 'var(--border)' }}
                       onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-s)'}
                       onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                         style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)' }}>
                      <svg className="w-4 h-4" style={{ color: '#a78bfa' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold" style={{ color: 'var(--text)', fontSize: 13 }}>{c.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                        {c.createdAt
                          ? new Date(c.createdAt.seconds * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                          : 'Just created'}
                      </p>
                    </div>
                    <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium"
                          style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Active
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {campaigns.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-14 rounded-2xl"
                 style={{ border: '1px dashed var(--border)' }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                   style={{ background: 'rgba(124,58,237,0.1)' }}>
                <svg className="w-6 h-6" style={{ color: '#a78bfa' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
              </div>
              <p className="font-semibold" style={{ color: 'var(--text-2)', fontSize: 13 }}>No campaigns yet</p>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>Create your first campaign above</p>
            </div>
          )}
        </div>
      )}

      {/* ── Assign Campaign ── */}
      {tab === 'assign' && (
        <div className="space-y-4">
          <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
              Select Campaign to Assign
            </p>
            {campaigns.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>No campaigns available. Create one first.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {campaigns.map(c => (
                  <button key={c.id}
                          onClick={() => setSelectedCampaign(c.id === selectedCampaign ? '' : c.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                          style={selectedCampaign === c.id
                            ? { background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', color: '#fff' }
                            : { background: 'var(--surface-s)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                    {c.name}
                  </button>
                ))}
              </div>
            )}
            {selectedCampaign && (
              <p className="text-xs font-medium" style={{ color: '#a78bfa' }}>
                ✓ "{campaigns.find(c => c.id === selectedCampaign)?.name}" selected — click Assign next to an employee
              </p>
            )}
          </div>

          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="px-4 py-2.5 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface-s)' }}>
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
                Employees ({employees.length})
              </span>
            </div>
            {employees.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm" style={{ color: 'var(--text-3)' }}>No employees found</p>
              </div>
            ) : (
              <div>
                {employees.map(emp => {
                  const hasCampaign = !!emp.campaign?.id;
                  const isAssigning = assigning === emp.id;
                  const empName = emp.name || emp.email?.split('@')[0] || '—';
                  return (
                    <div key={emp.id}
                         className="px-4 py-3.5 border-b last:border-b-0 flex items-center gap-3 transition-colors"
                         style={{ borderColor: 'var(--border)' }}
                         onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-s)'}
                         onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0"
                           style={{ background: 'linear-gradient(135deg,#7c3aed22,#3b82f622)', border: '1px solid rgba(124,58,237,0.2)' }}>
                        {emp.photoURL
                          ? <img src={emp.photoURL} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center font-bold text-violet-400" style={{ fontSize: 12 }}>
                              {empName.charAt(0).toUpperCase()}
                            </div>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate" style={{ color: 'var(--text)', fontSize: 13 }}>{empName}</p>
                        {hasCampaign ? (
                          <p className="text-xs mt-0.5 truncate" style={{ color: '#a78bfa' }}>
                            📣 {emp.campaign.name}
                          </p>
                        ) : (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>No campaign assigned</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {hasCampaign && (
                          <button
                            onClick={() => handleUnassign(emp.id, empName)}
                            disabled={isAssigning}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
                            style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                            {isAssigning ? '…' : 'Remove'}
                          </button>
                        )}
                        <button
                          onClick={() => handleAssign(emp.id, empName)}
                          disabled={isAssigning || !selectedCampaign}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                          style={selectedCampaign
                            ? { background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', color: '#fff', opacity: isAssigning ? 0.7 : 1 }
                            : { background: 'var(--surface-s)', color: 'var(--text-3)', cursor: 'not-allowed' }}>
                          {isAssigning ? 'Assigning…' : 'Assign'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
