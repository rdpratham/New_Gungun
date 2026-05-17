import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc, serverTimestamp, collection, query, where } from 'firebase/firestore';

function currentMonthIST() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()).slice(0, 7);
}
function formatMonth(m) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}
function getRecentMonths(n) {
  const out = [];
  let [y, m] = currentMonthIST().split('-').map(Number);
  for (let i = 0; i < n; i++) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    if (--m === 0) { m = 12; y--; }
  }
  return out;
}

export default function TeamTargetPage({ user }) {
  const months   = getRecentMonths(6);
  const [selMonth, setSelMonth]     = useState(currentMonthIST());
  const [targetInput, setTargetInput] = useState('');
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [docs, setDocs]             = useState({});     // month → doc data
  const [meetAgg, setMeetAgg]       = useState({});     // month → { completed, scheduled }

  // Listen to team target docs for all 6 months
  useEffect(() => {
    if (!user) return;
    const unsubs = months.map(m =>
      onSnapshot(doc(db, 'teamTargets', `${user.uid}_${m}`), snap => {
        setDocs(prev => ({ ...prev, [m]: snap.exists() ? snap.data() : null }));
      })
    );
    return () => unsubs.forEach(u => u());
  }, [user]);

  // Listen to meetings for each month to aggregate totals
  useEffect(() => {
    const unsubs = months.map(m => {
      const q = query(collection(db, 'meetings'), where('month', '==', m));
      return onSnapshot(q, snap => {
        const comp  = snap.docs.reduce((s, d) => s + (d.data().completed  || 0), 0);
        const sched = snap.docs.reduce((s, d) => s + (d.data().scheduled  || 0), 0);
        setMeetAgg(prev => ({ ...prev, [m]: { completed: comp, scheduled: sched } }));
      });
    });
    return () => unsubs.forEach(u => u());
  }, []);

  // Pre-fill input when selected month changes
  useEffect(() => {
    setTargetInput(docs[selMonth]?.target ? String(docs[selMonth].target) : '');
    setSaved(false);
  }, [selMonth, docs]);

  const handleSave = async () => {
    const t = parseInt(targetInput, 10);
    if (!t || t <= 0) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'teamTargets', `${user.uid}_${selMonth}`), {
        target: t, month: selMonth, updatedAt: serverTimestamp(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const cur  = docs[selMonth];
  const agg  = meetAgg[selMonth] || { completed: 0, scheduled: 0 };
  const pct  = cur?.target > 0 ? Math.min(agg.completed / cur.target, 1) : 0;
  const R    = 44, CIRC = 2 * Math.PI * R;

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600 }}>My Team Target</h1>
        <p style={{ color: 'var(--text-3)', fontSize: 11, marginTop: 2 }}>Set and track your team's monthly meeting target</p>
      </div>

      {/* Month selector */}
      <div className="flex gap-1.5 flex-wrap">
        {months.map(m => (
          <button key={m} onClick={() => setSelMonth(m)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={selMonth === m
              ? { background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', color: '#fff' }
              : { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
            {formatMonth(m)}
          </button>
        ))}
      </div>

      {/* Set target card */}
      <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-3)' }}>
          Set Target — {formatMonth(selMonth)}
        </p>
        <div className="flex items-center gap-3">
          <input
            type="number" min="1" value={targetInput}
            onChange={e => setTargetInput(e.target.value)}
            placeholder="e.g. 100"
            className="input-field"
            style={{ maxWidth: 160 }}
          />
          <button onClick={handleSave} disabled={saving || !targetInput}
            className="btn-primary flex-shrink-0"
            style={{ minWidth: 80 }}>
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
          </button>
        </div>
      </div>

      {/* Current month progress */}
      {cur?.target > 0 && (
        <div className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-3)' }}>
            {formatMonth(selMonth)} — Progress
          </p>
          <div className="flex items-center gap-6">
            {/* Ring */}
            <svg width={110} height={110} style={{ flexShrink: 0 }}>
              <defs>
                <linearGradient id="tg-ring" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#7c3aed" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
              <circle cx={55} cy={55} r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={8} />
              <circle cx={55} cy={55} r={R} fill="none" stroke="url(#tg-ring)" strokeWidth={8}
                strokeLinecap="round"
                strokeDasharray={`${CIRC * pct} ${CIRC}`}
                transform="rotate(-90 55 55)"
                style={{ transition: 'stroke-dasharray 1s ease', filter: 'drop-shadow(0 0 6px #7c3aed80)' }} />
              <text x={55} y={50} textAnchor="middle" fill="white" fontSize={20} fontWeight={700}>{Math.round(pct * 100)}%</text>
              <text x={55} y={66} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize={10}>achieved</text>
            </svg>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 flex-1">
              {[
                { label: 'Target',    value: cur.target,        color: '#60a5fa' },
                { label: 'Completed', value: agg.completed,     color: '#10b981' },
                { label: 'Scheduled', value: agg.scheduled,     color: '#f59e0b' },
                { label: 'Remaining', value: Math.max(0, cur.target - agg.completed), color: '#f87171' },
              ].map(s => (
                <div key={s.label} className="rounded-lg p-3 text-center" style={{ background: 'var(--surface-s)', border: '1px solid var(--border)' }}>
                  <p style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</p>
                  <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* History table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div className="px-4 py-2.5 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface-s)' }}>
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>6-Month History</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--surface-s)' }}>
              {['Month', 'Target', 'Completed', 'Scheduled', 'Achievement'].map(h => (
                <th key={h} style={{ padding: '8px 14px', textAlign: h === 'Month' ? 'left' : 'center', color: 'var(--text-3)', fontWeight: 500, fontSize: 11, borderBottom: '1px solid var(--border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {months.map(m => {
              const d   = docs[m];
              const agg = meetAgg[m] || { completed: 0, scheduled: 0 };
              const p   = d?.target > 0 ? Math.min(agg.completed / d.target, 1) : 0;
              const isCur = m === currentMonthIST();
              return (
                <tr key={m} style={{ borderBottom: '1px solid var(--border)', background: isCur ? 'rgba(124,58,237,0.04)' : 'transparent' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-s)'}
                    onMouseLeave={e => e.currentTarget.style.background = isCur ? 'rgba(124,58,237,0.04)' : 'transparent'}>
                  <td style={{ padding: '9px 14px', fontWeight: 500, color: isCur ? '#a78bfa' : 'var(--text-2)' }}>
                    {formatMonth(m)} {isCur && <span style={{ fontSize: 10, background: 'rgba(124,58,237,0.15)', color: '#a78bfa', padding: '1px 5px', borderRadius: 4, marginLeft: 4 }}>Current</span>}
                  </td>
                  <td style={{ padding: '9px 14px', textAlign: 'center', color: '#60a5fa', fontWeight: 600 }}>{d?.target || '—'}</td>
                  <td style={{ padding: '9px 14px', textAlign: 'center', color: '#10b981', fontWeight: agg.completed > 0 ? 600 : 400 }}>{agg.completed || '—'}</td>
                  <td style={{ padding: '9px 14px', textAlign: 'center', color: '#f59e0b', fontWeight: agg.scheduled > 0 ? 600 : 400 }}>{agg.scheduled || '—'}</td>
                  <td style={{ padding: '9px 14px', textAlign: 'center' }}>
                    {d?.target > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                        <div style={{ width: 60, height: 4, borderRadius: 99, background: 'var(--surface-s)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${p * 100}%`, background: 'linear-gradient(90deg,#7c3aed,#3b82f6)', borderRadius: 99, transition: 'width 1s' }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: p >= 1 ? '#10b981' : '#a78bfa' }}>{Math.round(p * 100)}%</span>
                      </div>
                    ) : <span style={{ color: 'var(--text-3)', fontSize: 11 }}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
