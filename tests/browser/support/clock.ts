import type { Clock } from '@/engine/engine';

export interface TestClock extends Clock {
  /** Moves time forward, running every timer that falls due on the way. */
  advance(ms: number): void;
  /**
   * The computer sleeps for `ms`: the wall clock moves on, while the
   * monotonic clock, and every timer with it, stands still, as in most
   * browsers.
   */
  sleep(ms: number): void;
  /** How many timers are waiting to run. */
  readonly pending: number;
}

/** A clock that only moves when the test says so. */
export function createTestClock(): TestClock {
  let monotonic = 0;
  // How far the wall clock is ahead of the monotonic one: the time slept.
  let slept = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; callback: () => void }>();

  return {
    now: () => monotonic + slept,
    monotonic: () => monotonic,

    setTimeout(callback, ms) {
      const id = nextId++;
      timers.set(id, { at: monotonic + Math.max(ms, 0), callback });
      return id;
    },

    clearTimeout(id) {
      timers.delete(id);
    },

    get pending() {
      return timers.size;
    },

    advance(ms) {
      const until = monotonic + ms;
      for (;;) {
        const due = [...timers.entries()]
          .filter(([, timer]) => timer.at <= until)
          .sort(([idA, timerA], [idB, timerB]) => timerA.at - timerB.at || idA - idB)[0];
        if (!due) break;
        const [id, timer] = due;
        timers.delete(id);
        monotonic = timer.at;
        timer.callback();
      }
      monotonic = until;
    },

    sleep(ms) {
      slept += ms;
    },
  };
}
