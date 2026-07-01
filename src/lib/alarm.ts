// Urgent, repeating order-alert sound (Web Audio). Distinct from a single
// notification ding — a fast triple-beep that repeats until acknowledged.
import { useEffect, useRef, useSyncExternalStore } from "react";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

// Browsers require a user gesture before audio can play. Call this from a
// click handler (e.g. the "Alerts on" toggle) to unlock the audio context.
export function primeAlarm() {
  const c = getCtx();
  if (c && c.state === "suspended") c.resume();
}

export type AlarmVariant = "admin" | "rider";

export function playAlert(variant: AlarmVariant = "admin") {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume();
  // Rider gets a brighter, higher pattern so it's recognisably different.
  const freqs = variant === "rider" ? [1568, 1976, 1568] : [988, 1319, 880];
  freqs.forEach((f, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "square";
    osc.frequency.value = f;
    osc.connect(gain);
    gain.connect(c.destination);
    const t = c.currentTime + i * 0.13;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.4, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    osc.start(t);
    osc.stop(t + 0.13);
  });
}

// Repeats the alert every ~1.6s while `active` is true and `enabled` is on.
export function useRepeatingAlarm(
  active: boolean,
  variant: AlarmVariant = "admin",
  enabled = true,
) {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const clear = () => {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    };
    if (active && enabled) {
      playAlert(variant);
      timer.current = setInterval(() => playAlert(variant), 1600);
    }
    return clear;
  }, [active, enabled, variant]);
}

// Shared on/off switch for the admin new-order alarm so the toggle on the
// dashboard and the always-on background watcher stay in sync.
let _adminAlarmOn = true;
const _adminAlarmSubs = new Set<() => void>();

export function setAdminAlarmOn(v: boolean) {
  _adminAlarmOn = v;
  _adminAlarmSubs.forEach((f) => f());
}

export function useAdminAlarmOn(): boolean {
  return useSyncExternalStore(
    (cb) => {
      _adminAlarmSubs.add(cb);
      return () => _adminAlarmSubs.delete(cb);
    },
    () => _adminAlarmOn,
    () => true,
  );
}