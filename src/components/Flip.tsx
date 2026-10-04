import React, { useEffect, useRef, useState } from 'react';
import { flapTick, flapLand } from '../lib/sound';
import { cn } from '../lib/utils';

/* ------------------------------------------------------------------ */
/* Split-flap primitives                                                */
/*                                                                     */
/* A flap is a card folded at a horizontal hinge: the static top half   */
/* already shows the incoming glyph while a leaf carrying the old glyph */
/* folds down over the hinge; a second leaf carrying the new glyph then */
/* drops into place with a small overshoot.                             */
/* ------------------------------------------------------------------ */

let lastTickAt = 0;
let lastLandAt = 0;
function tickSound() {
  const now = performance.now();
  if (now - lastTickAt > 28) { lastTickAt = now; flapTick(); }
}
function landSound() {
  const now = performance.now();
  if (now - lastLandAt > 28) { lastLandAt = now; flapLand(); }
}

export interface FlipDigitProps {
  char: string;                 // single character to display
  size?: number;                // glyph font-size in px
  width?: number;               // flap width px (defaults from size)
  delay?: number;               // ms before the flip begins (row cascade)
  duration?: number;            // ms for the whole flip
  accent?: boolean;             // signal-coloured flap
  quiet?: boolean;              // dimmed flap ink
  sound?: boolean;              // play relay click/thunk
  square?: boolean;             // letters look better a bit wider
  flipIn?: boolean;             // mount on the blank card, then flip to char
}

export function FlipDigit({
  char, size = 56, width, delay = 0, duration = 280,
  accent = false, quiet = false, sound = true, square = false, flipIn = false,
}: FlipDigitProps) {
  const [display, setDisplay] = useState(flipIn ? ' ' : char);
  // flipIn: seed the leaf at mount so the first paint already shows the blank
  // card mid-fold — seeding it in the effect instead would flash the fully
  // formed glyph for one frame before the cascade starts
  const [leaf, setLeaf] = useState<{ prev: string } | null>(flipIn ? { prev: ' ' } : null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (char === display) return;
    if (sound) tickSound();
    setLeaf({ prev: display });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setDisplay(char);
      setLeaf(null);
      if (sound) landSound();
    }, delay + duration + 60);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [char]);

  const fsH = size;
  const fsW = width ?? Math.round(size * (square ? 0.72 : 0.64));
  const style = {
    '--fs': `${Math.round(size * 0.78)}px`,
    '--fs-h': `${fsH}px`,
    '--fs-w': `${fsW}px`,
    '--flip-dur': `${duration}ms`,
    '--flip-delay': `${delay}ms`,
  } as React.CSSProperties;

  return (
    <div
      className={cn('flap', leaf && 'flap--flipping', accent && 'flap--accent', quiet && 'flap--quiet')}
      style={style}
      aria-label={display}
    >
      {/* static halves show the incoming glyph; the leaves cover them during the fold.
          The resting bottom card must keep the OUTGOING glyph until the top leaf has
          folded past the hinge — otherwise the digit reads half-new before the flip lands */}
      <div className="flap-half flap-half--top"><span className="flap-glyph">{char}</span></div>
      <div className="flap-half flap-half--bot"><span className="flap-glyph">{leaf ? leaf.prev : char}</span></div>
      {leaf && (
        <>
          <div className="flap-leaf flap-leaf--top"><span className="flap-glyph">{leaf.prev}</span></div>
          <div className="flap-leaf flap-leaf--bot"><span className="flap-glyph">{char}</span></div>
        </>
      )}
      <div className="flap-seam" />
    </div>
  );
}

/* Colon separator — optionally pulses once per second. */
export function FlipColon({ size = 56, live = false }: { size?: number; live?: boolean }) {
  return (
    <div
      className={cn('flap-colon', live && 'flap-colon--live')}
      style={{ '--fs-h': `${size}px` } as React.CSSProperties}
      aria-hidden
    >
      <i /><i />
    </div>
  );
}

export interface FlipRowProps {
  text: string;
  size?: number;
  delayStep?: number;      // cascade step ms, right to left
  duration?: number;
  accent?: boolean;
  quiet?: boolean;
  sound?: boolean;
  live?: boolean;          // colon heartbeat
  square?: boolean;
  flipIn?: boolean;        // start on the blank card so the row cascades in on mount
  className?: string;
}

/* A row of flaps rendering a string — ':' renders as a colon, ' ' as a gap. */
export function FlipRow({
  text, size = 56, delayStep = 42, duration = 280,
  accent = false, quiet = false, sound = true, live = false, square = false, flipIn = false,
  className,
}: FlipRowProps) {
  const chars = text.split('');
  const n = chars.length;
  return (
    <div className={cn('flex items-center', className)} style={{ gap: Math.max(2, Math.round(size * 0.05)) }}>
      {chars.map((c, i) => {
        const delay = (n - 1 - i) * delayStep;
        if (c === ':') return <FlipColon key={i} size={size} live={live} />;
        if (c === ' ') return <div key={i} style={{ width: Math.round(size * 0.3) }} />;
        return (
          <FlipDigit
            key={i}
            char={c}
            size={size}
            delay={delay}
            duration={duration}
            accent={accent}
            quiet={quiet}
            sound={sound}
            square={square}
            flipIn={flipIn}
          />
        );
      })}
    </div>
  );
}

/* Letter flaps spelling a word — used for board messages. */
export function FlipText({ text, size = 40, className, accent = false, delayStep = 55, sound = true }: {
  text: string; size?: number; className?: string; accent?: boolean; delayStep?: number; sound?: boolean;
}) {
  return (
    <FlipRow text={text.toUpperCase()} size={size} className={className} accent={accent} delayStep={delayStep} sound={sound} square flipIn />
  );
}

/* Rolling digit — a two-cell reel for values too fast to flap (centiseconds). */
export function RollDigit({ value, className }: { value: string; className?: string }) {
  const [curr, setCurr] = useState(value);
  const [prev, setPrev] = useState<string | null>(null);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<string | null>(null); // target of an in-flight roll

  useEffect(() => {
    if (value === curr && pending.current === null) return;
    if (value === pending.current) return; // already rolling to this
    // roll from wherever the previous roll was heading, not the stale commit
    setPrev(pending.current !== null ? pending.current : curr);
    pending.current = value;
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => {
      pending.current = null;
      setCurr(value);
      setPrev(null);
    }, 95);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span className={cn('roll', className)}>
      <span
        className="roll-strip"
        style={prev === null ? { transition: 'none', transform: 'translateY(0)' } : { transform: 'translateY(-1em)' }}
      >
        <span>{prev ?? curr}</span>
        <span>{value}</span>
      </span>
    </span>
  );
}

/* A framed instrument housing. */
export function Board({ children, label, right, className, inset = true, screws = true }: {
  children: React.ReactNode;
  label?: string;
  right?: React.ReactNode;
  className?: string;
  inset?: boolean;
  screws?: boolean;
}) {
  return (
    <div className={cn('board', screws && 'board-screws', 'px-5 py-4 md:px-7 md:py-5', className)}>
      {(label || right) && (
        <div className="flex items-center justify-between mb-3 px-0.5">
          {/* keyed remount → the engraved title slides in when it changes */}
          <span key={label} className="engraved text-[10px] md:text-xs board-label">{label}</span>
          {right}
        </div>
      )}
      {inset ? <div className="board-inset px-4 py-4 md:px-6">{children}</div> : children}
    </div>
  );
}
