import type { Clock } from '@/engine/engine';

export interface TestClock extends Clock {
  /** Moves time forward, running every timer that falls due on the way. */
  advance(ms: number): void;
  /** How many timers are waiting to run. */
  readonly pending: number;
}

/** A clock that only moves when the test says so. */
export function createTestClock(): TestClock {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; callback: () => void }>();

  return {
    now: () => now,

    setTimeout(callback, ms) {
      const id = nextId++;
      timers.set(id, { at: now + Math.max(ms, 0), callback });
      return id;
    },

    clearTimeout(id) {
      timers.delete(id);
    },

    get pending() {
      return timers.size;
    },

    advance(ms) {
      const until = now + ms;
      for (;;) {
        const due = [...timers.entries()]
          .filter(([, timer]) => timer.at <= until)
          .sort(([idA, timerA], [idB, timerB]) => timerA.at - timerB.at || idA - idB)[0];
        if (!due) break;
        const [id, timer] = due;
        timers.delete(id);
        now = timer.at;
        timer.callback();
      }
      now = until;
    },
  };
}
