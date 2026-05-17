import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';

function currentMonthIST() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()).slice(0, 7);
}
function formatMonth(m) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}
function getRecentMonths(n = 6) {
  const months = [];
  let [y, m] = currentMonthIST().split('-').map(Number);
  for (let i = 0; i < n; i++) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m--; if (m === 0) { m = 12; y--; }
  }
  return months;
}

/* Animated donut ring */
function DonutRing({ pct = 0, size = 160, strokeW = 16, color1 = '#7c3aed', color2 = '#3b82f6', label, sublabel }) {
  const R = (size - strokeW * 2) / 2;
  const CX = size / 2, CY = size / 2;
  const CIRC = 2 * Math.PI * R;
  const id = `dr-${size}-${label}`;
  return (
    <svg width={size} height={size}>
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color1} />
          <stop offset="100%" stopColor={color2} />
        </linearGradient>
        <filter id={`${id}-glow`}>
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      {/* Track */}
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={strokeW} />
      {/* Progress */}
      {pct > 0 && (
        <circle cx={CX} cy={CY} r={R} fill="none" stroke={`url(#${id})`} strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={`${CIRC * Math.min(pct, 1)} ${CIRC}`}
          transform={`rotate(-90 ${CX} ${CY})`}
          style={{ transition: 'stroke-dasharray 1s ease', filter: `drop-shadow(0 0 6px ${color1}80)` }} />
      )}
      {label !== undefined && (
        <>
          <text x={CX} y={CY - 8} textAnchor="middle" fill="white" fontSize={size > 120 ? 28 : 18} fontWeight="800">{label}</text>
          {sublabel && <text x={CX} y={CY + 14} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize={12}>{sublabel}</text>}
        </>
      )}
    </svg>
  );
}

/* Counter input with +/- buttons */
function CounterInput({ value, onChange, min = 0, max = 999, label, color1, color2 }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>{label}</div>
      <div className="flex items-center gap-3 rounded-2xl px-4 py-3"
        style={{ background: 'var(--surface-s)', border: `2px solid ${color1}40` }}>
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-9 h-9 rounded-full flex items-center justify-center text-xl font-bold transition-all hover:scale-110"
          style={{ background: `linear-gradient(135deg,${color1},${color2})`, color: 'white' }}>
          −
        </button>
        <div className="text-3xl font-bold w-12 text-center" style={{
          background: `linear-gradient(135deg,${color1},${color2})`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
        }}>
          {value}
        </div>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          className="w-9 h-9 rounded-full flex items-center justify-center text-xl font-bold transition-all hover:scale-110"
          style={{ background: `linear-gradient(135deg,${color1},${color2})`, color: 'white' }}>
          +
        </button>
      </div>
    </div>
  );
}

export default function AssignedMeetings({ user, employeeData }) {
  const [month, setMonth] = useState(currentMonthIST());
  const [meetingData, setMeetingData] = useState(null);
  const [completed, setCompleted] = useState(0);
  const [scheduled, setScheduled] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const months = getRecentMonths(6);

  const uid = user?.uid;
  const docId = uid ? `${uid}_${month}` : null;

  useEffect(() => {
    if (!docId) return;
    return onSnapshot(doc(db, 'meetings', docId), snap => {
      if (snap.exists()) {
        const d = snap.data();
        setMeetingData(d);
        setCompleted(d.completed || 0);
        setScheduled(d.scheduled || 0);
      } else {
        setMeetingData(null);
        setCompleted(0);
        setScheduled(0);
      }
    });
  }, [docId]);

  async function handleSave() {
    if (!docId || !meetingData) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'meetings', docId), {
        completed, scheduled, updatedAt: serverTimestamp()
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  }

  const target = meetingData?.target || 0;
  const completedPct = target > 0 ? completed / target : 0;
  const scheduledPct = target > 0 ? scheduled / target : 0;
  const remaining = Math.max(0, target - completed);
  const hasTarget = !!meetingData;
  const isDirty = hasTarget && (completed !== (meetingData?.completed || 0) || scheduled !== (meetingData?.scheduled || 0));

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>My Meeting Targets</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>Track your monthly meeting progress</p>
        </div>
        <select value={month} onChange={e => setMonth(e.target.value)} className="input-field w-auto">
          {months.map(m => <option key={m} value={m}>{formatMonth(m)}</option>)}
        </select>
      </div>

      {!hasTarget ? (
        <div className="card rounded-2xl p-12 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="text-5xl mb-4">🎯</div>
          <div className="font-bold text-xl mb-2" style={{ color: 'var(--text)' }}>No Target Assigned</div>
          <div className="text-sm" style={{ color: 'var(--text-3)' }}>Your manager hasn't assigned a meeting target for {formatMonth(month)} yet</div>
        </div>
      ) : (
        <>
          {/* Hero progress card */}
          <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg,#7c3aed,#3b82f6)', border: '1px solid var(--border)' }}>
            <div className="p-6">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative flex-shrink-0">
                  <DonutRing pct={completedPct} size={180} strokeW={18} color1="#fff" color2="rgba(255,255,255,0.5)"
                    label={completed} sublabel={`of ${target}`} />
                </div>
                <div className="flex-1 text-white space-y-3">
                  <div>
                    <div className="text-sm opacity-70">Monthly Target — {formatMonth(month)}</div>
                    <div className="text-4xl font-black mt-1">{target} <span className="text-xl font-normal opacity-70">meetings</span></div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Done', value: completed, color: 'rgba(255,255,255,0.9)' },
                      { label: 'Scheduled', value: scheduled, color: 'rgba(255,255,255,0.9)' },
                      { label: 'Remaining', value: remaining, color: remaining > 0 ? '#fcd34d' : '#86efac' },
                    ].map(s => (
                      <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
                        <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                        <div className="text-xs opacity-70 mt-0.5">{s.label}</div>
                      </div>
                    ))}
                  </div>
                  {meetingData.comment && (
                    <div className="rounded-xl p-3 text-sm" style={{ background: 'rgba(255,255,255,0.15)' }}>
                      <span className="opacity-60">Note: </span>{meetingData.comment}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Progress bars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-2)' }}>Completion Rate</span>
                <span className="text-sm font-bold" style={{ color: '#7c3aed' }}>{Math.round(completedPct * 100)}%</span>
              </div>
              <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: 'var(--surface-s)' }}>
                <div className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${Math.min(completedPct * 100, 100)}%`, background: 'linear-gradient(90deg,#7c3aed,#3b82f6)' }} />
              </div>
            </div>
            <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-2)' }}>Scheduled Rate</span>
                <span className="text-sm font-bold" style={{ color: '#ec4899' }}>{Math.round(scheduledPct * 100)}%</span>
              </div>
              <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: 'var(--surface-s)' }}>
                <div className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${Math.min(scheduledPct * 100, 100)}%`, background: 'linear-gradient(90deg,#ec4899,#f97316)' }} />
              </div>
            </div>
          </div>

          {/* Update section */}
          <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h2 className="font-bold text-lg mb-6" style={{ color: 'var(--text)' }}>Update Progress</h2>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <CounterInput value={completed} onChange={setCompleted} min={0} max={target}
                label="Meetings Completed" color1="#7c3aed" color2="#3b82f6" />
              <CounterInput value={scheduled} onChange={setScheduled} min={0} max={999}
                label="Meetings Scheduled" color1="#ec4899" color2="#f97316" />
            </div>
            <div className="flex justify-center mt-6">
              <button
                onClick={handleSave}
                disabled={saving || !isDirty}
                className="btn-primary px-8 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all duration-200"
                style={{ opacity: isDirty ? 1 : 0.5, transform: saving ? 'scale(0.98)' : 'scale(1)' }}>
                {saving ? (
                  <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving...</>
                ) : saved ? (
                  <>✓ Saved!</>
                ) : (
                  <>Save Progress</>
                )}
              </button>
            </div>
            {!isDirty && !saving && (
              <p className="text-center text-xs mt-3" style={{ color: 'var(--text-3)' }}>Change a value above to enable saving</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
