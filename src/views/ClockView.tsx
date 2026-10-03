import { useEffect, useRef, useState } from 'react';
import { Plus, X, Bell, BellOff, Trash2, AlarmClock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, vibrate } from '../lib/utils';
import { useNow, useWakeLock } from '../hooks/useTimer';
import { useViewport } from '../hooks/useViewport';
import { FlipRow, FlipText, Board } from '../components/Flip';
import { KeyButton } from '../components/KeyButton';
import { alarmRing, flapTick } from '../lib/sound';

interface Alarm { id: string; hh: number; mm: number; on: boolean; label: string }
const KEY = 'platform.alarms.v1';

function loadAlarms(): Alarm[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

export default function ClockView() {
  const now = useNow(1000);
  const vp = useViewport();
  const [alarms, setAlarms] = useState<Alarm[]>(loadAlarms);
  const [showAdd, setShowAdd] = useState(false);
  const [newH, setNewH] = useState(7);
  const [newM, setNewM] = useState(30);
  const [newLabel, setNewLabel] = useState('');
  const [firing, setFiring] = useState<Alarm | null>(null);
  const stopRing = useRef<null | (() => void)>(null);
  const lastFiredKey = useRef('');

  useWakeLock(!!firing);

  const save = (a: Alarm[]) => { setAlarms(a); localStorage.setItem(KEY, JSON.stringify(a)); };

  /* fire check — once per minute per alarm */
  useEffect(() => {
    const key = `${now.toDateString()}:${now.getHours()}:${now.getMinutes()}`;
    if (lastFiredKey.current === key) return;
    const hit = alarms.find(a => a.on && a.hh === now.getHours() && a.mm === now.getMinutes());
    if (hit && !firing) {
      lastFiredKey.current = key;
      setFiring(hit);
      vibrate([200, 100, 200, 100, 400]);
      stopRing.current = alarmRing();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  const dismiss = () => {
    stopRing.current?.(); stopRing.current = null;
    setFiring(null);
  };
  const snooze = () => {
    stopRing.current?.(); stopRing.current = null;
    const t = new Date(now.getTime() + 10 * 60000);
    const base = (firing!.label || 'Alarm').replace(/ \+\d+m$/, '');
    const snoozed = { ...firing!, hh: t.getHours(), mm: t.getMinutes(), on: true, label: base + ' +10m' };
    lastFiredKey.current = '';
    save(alarms.map(a => a.id === firing!.id ? snoozed : a));
    setFiring(null);
  };

  const addAlarm = () => {
    save([...alarms, { id: Math.random().toString(36).slice(2, 8), hh: newH, mm: newM, on: true, label: newLabel || 'Alarm' }]);
    setShowAdd(false); setNewLabel('');
    flapTick(); vibrate(20);
  };

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const clockStr = `${hh}:${mm}:${ss}`;
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const flipSize = Math.max(56, Math.min(120, Math.round(vp.w / 9.4)));

  return (
    <div className="flex-1 w-full flex flex-col lg:flex-row items-center lg:items-start justify-center gap-10 lg:gap-16 px-4 md:px-8 py-6 max-w-6xl mx-auto">
      <div className="flex flex-col items-center gap-6">
        <Board label="Local time" right={
          <span className="engraved text-[10px] md:text-xs" style={{ color: 'var(--color-brass-hi)' }}>
            {now.toLocaleTimeString('en-US', { hour12: false, timeZoneName: 'short' }).split(' ').pop()}
          </span>
        }>
          <FlipRow text={clockStr} size={flipSize} live />
        </Board>
        <div className="label-wall text-xs md:text-sm" style={{ letterSpacing: '0.3em' }}>{dateStr.toUpperCase()}</div>
      </div>

      {/* ---------- ALARMS ---------- */}
      <div className="w-full max-w-sm flex flex-col">
        <div className="flex items-end justify-between mb-5">
          <div>
            <div className="label-wall text-[10px] mb-1">Calls</div>
            <div className="font-display text-3xl font-bold text-ink uppercase leading-none">Alarms</div>
          </div>
          <button onClick={() => setShowAdd(true)} className="chip px-3 py-1.5 text-[10px] flex items-center gap-1.5">
            <Plus size={12} /> New
          </button>
        </div>

        {alarms.length === 0 ? (
          <div className="panel-wall p-6 text-sm text-ink-soft font-body leading-relaxed">
            No calls on the board. Add an alarm and it will ring while this page is open.
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {alarms.map(a => (
                <motion.div
                  key={a.id}
                  layout
                  initial={{ opacity: 0, y: -14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                  className="panel-wall px-4 py-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <span className="font-display font-bold text-2xl text-ink">
                      {String(a.hh).padStart(2, '0')}:{String(a.mm).padStart(2, '0')}
                    </span>
                    <span className="text-sm text-ink-soft font-body truncate max-w-[10rem]">{a.label}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { vibrate(15); save(alarms.map(x => x.id === a.id ? { ...x, on: !x.on } : x)); }}
                      className={cn('p-2 rounded-md transition-colors', a.on ? 'text-[color:var(--color-signal)]' : 'text-ink-faint')}
                      title={a.on ? 'Enabled' : 'Off'}
                    >
                      {a.on ? <Bell size={17} /> : <BellOff size={17} />}
                    </button>
                    <button
                      onClick={() => { vibrate(15); save(alarms.filter(x => x.id !== a.id)); }}
                      className="p-2 rounded-md text-ink-faint hover:text-[color:var(--color-signal)] transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ---------- ADD ALARM ---------- */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[210] flex items-center justify-center p-4"
            style={{ background: 'rgba(15,12,6,0.7)', backdropFilter: 'blur(6px)' }}
            onClick={() => setShowAdd(false)}
          >
            <motion.div
              initial={{ y: 40, scale: 0.96 }} animate={{ y: 0, scale: 1 }} exit={{ y: 30, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              className="board board-screws p-6 w-full max-w-sm"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <span className="engraved text-xs">New alarm</span>
                <button onClick={() => setShowAdd(false)} className="text-flap-dim hover:text-flap-ink"><X size={18} /></button>
              </div>
              <div className="flex items-center justify-center gap-3 mb-5">
                <div className="flex flex-col items-center gap-2">
                  <KeyButton className="w-10 h-10 !rounded-lg" onClick={() => setNewH(h => (h + 1) % 24)}><Plus size={14} /></KeyButton>
                  <FlipRow text={String(newH).padStart(2, '0')} size={52} sound={false} />
                  <KeyButton className="w-10 h-10 !rounded-lg" onClick={() => setNewH(h => (h + 23) % 24)}><span className="text-lg leading-none">−</span></KeyButton>
                </div>
                <span className="engraved text-2xl pb-2">:</span>
                <div className="flex flex-col items-center gap-2">
                  <KeyButton className="w-10 h-10 !rounded-lg" onClick={() => setNewM(m => (m + 5) % 60)}><Plus size={14} /></KeyButton>
                  <FlipRow text={String(newM).padStart(2, '0')} size={52} sound={false} />
                  <KeyButton className="w-10 h-10 !rounded-lg" onClick={() => setNewM(m => (m + 55) % 60)}><span className="text-lg leading-none">−</span></KeyButton>
                </div>
              </div>
              <input
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                placeholder="Label — e.g. Standup"
                className="w-full mb-5 bg-board-inset bg-[#0F0C06] border border-[rgba(242,233,207,0.12)] rounded-lg px-4 py-2.5 text-sm text-flap-ink placeholder:text-flap-dim focus:outline-none focus:border-[rgba(242,233,207,0.3)] font-body"
              />
              <KeyButton variant="signal" className="w-full py-3.5 text-sm" onClick={addAlarm}>
                Post alarm
              </KeyButton>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------- ALARM FIRING ---------- */}
      <AnimatePresence>
        {firing && (
          <motion.div
            key="alarm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex flex-col items-center justify-center overflow-hidden"
            style={{ background: 'linear-gradient(180deg, #1B1509 0%, #0F0C06 100%)' }}
          >
            <motion.div
              animate={{ opacity: [0.06, 0.16, 0.06] }}
              transition={{ duration: 1.4, repeat: Infinity }}
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(55% 40% at 50% 40%, var(--color-signal), transparent 70%)' }}
            />
            <motion.div
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }}
              className="flex flex-col items-center gap-8 z-10"
            >
              <AlarmClock size={40} style={{ color: 'var(--color-signal-bright)' }} />
              <FlipText text={(firing.label || 'ALARM').toUpperCase().slice(0, 14)} size={Math.min(64, vp.w / 14)} />
              <div className="engraved text-sm" style={{ letterSpacing: '0.4em' }}>
                {String(firing.hh).padStart(2, '0')}:{String(firing.mm).padStart(2, '0')} — NOW
              </div>
              <div className="flex gap-4 mt-2">
                <KeyButton variant="signal" className="px-10 py-4 text-sm" onClick={dismiss}>Dismiss</KeyButton>
                <KeyButton className="px-8 py-4 text-sm" onClick={snooze}>+10 min</KeyButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
