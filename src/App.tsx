import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Timer, Watch, Clock, Repeat2, LayoutGrid, BarChart3, Settings } from 'lucide-react';
import { cn, vibrate } from '@/src/lib/utils';
import { unlockAudio, flapTick } from '@/src/lib/sound';
import { applySettings } from '@/src/lib/settings';
import TimerView from './views/TimerView';
import StopwatchView from './views/StopwatchView';
import ClockView from './views/ClockView';
import IntervalsView from './views/IntervalsView';
import PresetsView from './views/PresetsView';
import StatsView from './views/StatsView';
import SettingsView from './views/SettingsView';
import { BootSequence } from './components/BootSequence';

type View = 'timer' | 'stopwatch' | 'clock' | 'intervals' | 'presets' | 'stats' | 'settings';

const NAV: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: 'timer',     label: 'Timer',     icon: <Timer size={19} strokeWidth={2.1} /> },
  { id: 'stopwatch', label: 'Watch',     icon: <Watch size={19} strokeWidth={2.1} /> },
  { id: 'clock',     label: 'Clock',     icon: <Clock size={19} strokeWidth={2.1} /> },
  { id: 'intervals', label: 'Routes',    icon: <Repeat2 size={19} strokeWidth={2.1} /> },
  { id: 'presets',   label: 'Departures',icon: <LayoutGrid size={19} strokeWidth={2.1} /> },
  { id: 'stats',     label: 'Ledger',    icon: <BarChart3 size={19} strokeWidth={2.1} /> },
  { id: 'settings',  label: 'Settings',  icon: <Settings size={19} strokeWidth={2.1} /> },
];

export default function App() {
  const [view, setView] = useState<View>('timer');
  const [preset, setPreset] = useState<{ minutes: number; name?: string; n: number }>({ minutes: 25, n: 0 });
  const [focusMode, setFocusMode] = useState(false);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    applySettings();
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: false });
    window.addEventListener('keydown', unlock, { once: false });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const selectPreset = (minutes: number, name?: string) => {
    setPreset(p => ({ minutes, name, n: p.n + 1 }));
    setView('timer');
  };

  return (
    <div className="min-h-screen flex flex-col wall-tex text-ink font-body overflow-x-hidden">
      {!booted && <BootSequence onDone={() => setBooted(true)} />}

      {/* ---------- header ---------- */}
      <AnimatePresence>
        {!focusMode && (
          <motion.header
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 26 }}
            className="w-full flex justify-between items-center px-5 md:px-8 pt-5 pb-1 z-40"
          >
            <div className="flex items-center gap-3">
              {/* wordmark — a tiny two-flap mark + type */}
              <div className="flex gap-[3px]">
                <span className="block w-[13px] h-[18px] rounded-[2px]" style={{ background: 'var(--color-board)', boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.4)' }} />
                <span className="block w-[13px] h-[18px] rounded-[2px]" style={{ background: 'var(--color-signal)', boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.35)' }} />
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-display font-bold text-lg tracking-[0.14em] text-ink">PLATFORM</span>
                <span className="label-wall text-[8px]" style={{ letterSpacing: '0.34em' }}>TIME INSTRUMENTS</span>
              </div>
            </div>
            <span className="label-wall text-[10px] hidden sm:block" style={{ letterSpacing: '0.28em' }}>
              EST. YOUR WORKDAY
            </span>
          </motion.header>
        )}
      </AnimatePresence>

      {/* ---------- content ---------- */}
      <main className={cn('flex-1 flex flex-col w-full relative', !focusMode && 'pb-32')}>
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 20, rotateX: 4 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            exit={{ opacity: 0, y: -14, rotateX: -3 }}
            transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
            className="flex-1 flex flex-col w-full"
            style={{ transformOrigin: '50% 0%', perspective: 900 }}
          >
            {view === 'timer' && (
              <TimerView
                key={preset.n}
                presetMinutes={preset.minutes}
                presetName={preset.name}
                onFocusModeChange={setFocusMode}
              />
            )}
            {view === 'stopwatch' && <StopwatchView />}
            {view === 'clock' && <ClockView />}
            {view === 'intervals' && <IntervalsView />}
            {view === 'presets' && <PresetsView onSelectPreset={selectPreset} />}
            {view === 'stats' && <StatsView />}
            {view === 'settings' && <SettingsView />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ---------- dock ---------- */}
      <AnimatePresence>
        {!focusMode && (
          <motion.nav
            initial={{ y: 90, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 90, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 26, delay: 0.05 }}
            className="fixed bottom-5 left-0 right-0 z-[100] flex justify-center px-4"
          >
            <div className="board board-screws !rounded-2xl px-2 py-2 flex items-center gap-0.5">
              {NAV.map((item, i) => {
                const active = view === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => { if (!active) { vibrate(18); flapTick(0.03); setView(item.id); } }}
                    className={cn(
                      'relative flex flex-col items-center justify-center px-3 md:px-4 py-2 rounded-xl transition-colors duration-150',
                      active ? 'text-[color:var(--color-signal-bright)]' : 'text-flap-dim hover:text-flap-ink'
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="dock-pip"
                        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-[3px] rounded-full"
                        style={{ background: 'var(--color-signal-bright)', boxShadow: '0 0 8px var(--color-signal)' }}
                        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                      />
                    )}
                    <motion.span
                      animate={active ? { y: [0, -2, 0] } : { y: 0 }}
                      transition={{ duration: 0.3 }}
                      key={`${item.id}-${active}`}
                    >
                      {item.icon}
                    </motion.span>
                    <span className="engraved text-[8px] mt-1.5 hidden sm:block" style={{ letterSpacing: '0.16em' }}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </div>
  );
}
