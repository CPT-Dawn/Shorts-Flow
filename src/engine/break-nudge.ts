import type { Feed } from './feed';

/** The Break Nudge's notice over the player. */
export type BreakNudge = {
  /** Shows the notice; `onDismiss` is called once the viewer dismisses it. */
  show(onDismiss: () => void): void;
  readonly shown: boolean;
};

export function createBreakNudge(_feed: Feed): BreakNudge {
  return {
    show() {},
    shown: false,
  };
}
