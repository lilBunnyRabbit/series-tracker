import { vibrate } from "$lib/haptics";
import type { Status } from "$lib/types";

type HapticPattern = "tap" | "tick" | "success" | "warn";

type TactileOptions = {
  /** Haptic pattern fired on press-down. Pass `false` to suppress. Default `"tap"`. */
  haptic?: HapticPattern | false;
};

/**
 * Press-feedback Svelte action. On pointerdown: schedules `.is-pressed` for
 * the scale-down. On pointerup: removes the class AND fires the haptic IF the
 * pointer barely moved (treating it as a tap, not a scroll). Pair with a
 * `.tap-target--*` utility class for the visual scale-down.
 *
 * Why haptic on pointerup with movement check, not pointerdown — every touch
 * starts with pointerdown including the start of a scroll gesture. Firing the
 * haptic immediately means scrolling a list vibrates the phone for every card
 * we cross. Waiting for pointerup and checking that the pointer didn't move
 * means we only vibrate on real taps.
 *
 * Why delay the visual press on touch — same reason. Adding `.is-pressed`
 * immediately on touch means every scroll-start visibly shrinks whichever
 * card the finger landed on. Buying a short delay (~90ms) lets the gesture
 * declare itself: real taps end well after that and still get the visual,
 * scroll-starts move past the threshold and we never paint the press state.
 * Mouse is instant — pointer-on-mouse never starts a scroll mid-press.
 */
const TAP_MOVEMENT_THRESHOLD = 8;
const TOUCH_PRESS_DELAY_MS = 90;

export function tactile(node: HTMLElement, options: TactileOptions = {}) {
  let opts = options;
  let pressed = false;
  let startX = 0;
  let startY = 0;
  let pressTimer: ReturnType<typeof setTimeout> | null = null;

  function clearPressTimer(): void {
    if (pressTimer === null) return;
    clearTimeout(pressTimer);
    pressTimer = null;
  }
  function applyPressed(): void {
    node.classList.add("is-pressed");
  }
  function clearPressed(): void {
    node.classList.remove("is-pressed");
  }

  function press(e: PointerEvent): void {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (pressed) return;
    pressed = true;
    startX = e.clientX;
    startY = e.clientY;
    clearPressTimer();
    if (e.pointerType === "mouse") {
      applyPressed();
    } else {
      pressTimer = setTimeout(() => {
        pressTimer = null;
        if (pressed) applyPressed();
      }, TOUCH_PRESS_DELAY_MS);
    }
  }
  function release(e: PointerEvent): void {
    if (!pressed) return;
    pressed = false;
    clearPressTimer();
    clearPressed();
    if (opts.haptic === false) return;
    const dx = Math.abs(e.clientX - startX);
    const dy = Math.abs(e.clientY - startY);
    if (dx > TAP_MOVEMENT_THRESHOLD || dy > TAP_MOVEMENT_THRESHOLD) return;
    vibrate(opts.haptic ?? "tap");
  }
  function cancel(): void {
    if (!pressed) return;
    pressed = false;
    clearPressTimer();
    clearPressed();
  }
  function move(e: PointerEvent): void {
    if (!pressed) return;
    const dx = Math.abs(e.clientX - startX);
    const dy = Math.abs(e.clientY - startY);
    if (dx > TAP_MOVEMENT_THRESHOLD || dy > TAP_MOVEMENT_THRESHOLD) {
      pressed = false;
      clearPressTimer();
      clearPressed();
    }
  }

  node.addEventListener("pointerdown", press);
  node.addEventListener("pointermove", move);
  node.addEventListener("pointerup", release);
  node.addEventListener("pointercancel", cancel);
  node.addEventListener("pointerleave", cancel);

  return {
    update(next: TactileOptions) {
      opts = next;
    },
    destroy() {
      clearPressTimer();
      node.removeEventListener("pointerdown", press);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", release);
      node.removeEventListener("pointercancel", cancel);
      node.removeEventListener("pointerleave", cancel);
    },
  };
}

type SwipeToDismissOptions = {
  /** Element whose translateY mirrors the drag — typically the dialog itself.
   *  Falls back to the node the action is on when omitted. */
  target?: HTMLElement;
  /** Distance in px past which a release triggers dismissal. Default 80. */
  threshold?: number;
  /** Fires once the drag releases past the threshold. */
  onDismiss: () => void;
};

/** Extracted from the original inline StatusMenu impl so every bottom sheet can
 *  share one tested gesture path. Touch-only (mouse/desktop have explicit close
 *  buttons), pointer-captured so the drag survives the finger leaving the drag
 *  zone, and self-cleans the inline transform/transition once the gesture
 *  settles so the next open animation isn't stuck mid-translate.
 *
 *  Why the action mutates `target.style` directly instead of a Svelte-side
 *  `$state` mirror: the action lives in `tactile.ts` (no rune scope) and the
 *  consumers are dialogs whose only knob is style. Keeping it as imperative DOM
 *  writes means each sheet just does `<div use:swipeToDismiss={{ target: dialog,
 *  onDismiss: close }}>` — no per-component state plumbing. */
const SWIPE_RELEASE_MS = 200;

export function swipeToDismiss(node: HTMLElement, options: SwipeToDismissOptions) {
  let opts = options;
  let dragging = false;
  let startY = 0;
  let pointerId = -1;

  function getTarget(): HTMLElement {
    return opts.target ?? node;
  }
  function applyTransform(dy: number, animate: boolean): void {
    const t = getTarget();
    t.style.transition = animate ? `transform ${SWIPE_RELEASE_MS}ms var(--ease-spring)` : "none";
    t.style.transform = dy > 0 ? `translateY(${dy}px)` : "";
  }
  function clearInline(): void {
    const t = getTarget();
    t.style.transition = "";
    t.style.transform = "";
  }

  function down(e: PointerEvent): void {
    if (e.pointerType !== "touch") return;
    dragging = true;
    pointerId = e.pointerId;
    startY = e.clientY;
    applyTransform(0, false);
    try {
      node.setPointerCapture(pointerId);
    } catch {
      // setPointerCapture can throw on some Safari versions if the pointer
      // type isn't capturable — gesture still works via target tracking.
    }
  }
  function move(e: PointerEvent): void {
    if (!dragging || e.pointerId !== pointerId) return;
    const dy = Math.max(0, e.clientY - startY);
    applyTransform(dy, false);
  }
  function up(e: PointerEvent): void {
    if (!dragging) return;
    const dy = Math.max(0, e.clientY - startY);
    dragging = false;
    pointerId = -1;
    const threshold = opts.threshold ?? 80;
    if (dy > threshold) {
      // Slide the sheet off the bottom of the viewport, then dismiss. The
      // consumer's close path runs dialog.close() once onDismiss fires; we
      // clear the inline transform on the next frame so a re-open of the
      // dialog isn't pre-shifted.
      applyTransform(window.innerHeight, true);
      window.setTimeout(() => {
        opts.onDismiss();
        requestAnimationFrame(clearInline);
      }, SWIPE_RELEASE_MS);
    } else {
      applyTransform(0, true);
      window.setTimeout(clearInline, SWIPE_RELEASE_MS + 20);
    }
  }

  node.addEventListener("pointerdown", down);
  node.addEventListener("pointermove", move);
  node.addEventListener("pointerup", up);
  node.addEventListener("pointercancel", up);

  return {
    update(next: SwipeToDismissOptions) {
      opts = next;
    },
    destroy() {
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", up);
    },
  };
}

const STATUS_PULSE_DURATION_MS = 850;

/**
 * Briefly applies `.is-status-pulse` to the host element when `status` changes
 * — visual confirmation of a long-press status flip alongside the haptic that
 * fired in `CardActionsSheet`. The pulse colour is read from the same
 * `--tt-c` custom property the cards already set for the temptation glow, so
 * no extra plumbing per card.
 *
 * Skips the initial mount (no pulse on first render). Re-pulses correctly if
 * status changes again before the first pulse completes — the class is
 * removed-then-reapplied with a forced reflow so the keyframes restart.
 */
export function statusPulse(node: HTMLElement, status: Status) {
  let prev: Status = status;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function fire(): void {
    if (timer) clearTimeout(timer);
    node.classList.remove("is-status-pulse");
    void node.offsetWidth;
    node.classList.add("is-status-pulse");
    timer = setTimeout(() => {
      node.classList.remove("is-status-pulse");
      timer = null;
    }, STATUS_PULSE_DURATION_MS);
  }

  return {
    update(next: Status) {
      if (next === prev) return;
      prev = next;
      fire();
    },
    destroy() {
      if (timer) clearTimeout(timer);
    },
  };
}

type LongPressOptions = {
  /** Milliseconds before fire. Default 400. */
  duration?: number;
  /** Pixel movement threshold that cancels the press. Default 8. */
  threshold?: number;
  /** Called when the timer fires (i.e. user held without moving). */
  onLongPress: () => void;
};

/**
 * Long-press Svelte action. Fires `onLongPress` after `duration` ms of held
 * pointer with movement under `threshold` pixels. Suppresses the synthetic
 * click that follows so the host element's onclick doesn't navigate when the
 * user expected the long-press menu.
 */
export function longPress(node: HTMLElement, options: LongPressOptions) {
  let opts = options;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let startX = 0;
  let startY = 0;
  let fired = false;

  function clear(): void {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function down(e: PointerEvent): void {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    fired = false;
    startX = e.clientX;
    startY = e.clientY;
    clear();
    timer = setTimeout(() => {
      timer = null;
      fired = true;
      vibrate("success");
      opts.onLongPress();
    }, opts.duration ?? 400);
  }

  function move(e: PointerEvent): void {
    if (!timer) return;
    const dx = Math.abs(e.clientX - startX);
    const dy = Math.abs(e.clientY - startY);
    const t = opts.threshold ?? 8;
    if (dx > t || dy > t) clear();
  }

  function up(): void {
    clear();
  }

  function suppressClick(e: MouseEvent): void {
    if (!fired) return;
    fired = false;
    e.preventDefault();
    e.stopPropagation();
  }

  node.addEventListener("pointerdown", down);
  node.addEventListener("pointermove", move);
  node.addEventListener("pointerup", up);
  node.addEventListener("pointercancel", up);
  node.addEventListener("pointerleave", up);
  node.addEventListener("click", suppressClick, true);

  return {
    update(next: LongPressOptions) {
      opts = next;
    },
    destroy() {
      clear();
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", up);
      node.removeEventListener("pointerleave", up);
      node.removeEventListener("click", suppressClick, true);
    },
  };
}
