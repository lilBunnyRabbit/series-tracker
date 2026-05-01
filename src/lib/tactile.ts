import { vibrate } from "$lib/haptics";

type HapticPattern = "tap" | "tick" | "success" | "warn";

type TactileOptions = {
  /** Haptic pattern fired on press-down. Pass `false` to suppress. Default `"tap"`. */
  haptic?: HapticPattern | false;
};

/**
 * Press-feedback Svelte action. On pointerdown: fires the haptic + adds
 * `.is-pressed`. On release / cancel / leave: removes `.is-pressed`. Pair with
 * a `.tap-target--*` utility class for the visual scale-down.
 *
 * Why a class and not :active alone — :active doesn't fire on a parent <a> when
 * the user taps a child, and on iOS sometimes sticks until you tap elsewhere.
 * pointerdown/up gives us deterministic feedback that fires the haptic at the
 * exact moment the user touches the screen (clicks fire ~100ms later, after
 * scroll-detection, which feels disconnected from the vibration).
 */
export function tactile(node: HTMLElement, options: TactileOptions = {}) {
  let opts = options;
  let pressed = false;

  function press(e: PointerEvent): void {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (pressed) return;
    pressed = true;
    node.classList.add("is-pressed");
    if (opts.haptic !== false) vibrate(opts.haptic ?? "tap");
  }
  function release(): void {
    if (!pressed) return;
    pressed = false;
    node.classList.remove("is-pressed");
  }

  node.addEventListener("pointerdown", press);
  node.addEventListener("pointerup", release);
  node.addEventListener("pointercancel", release);
  node.addEventListener("pointerleave", release);

  return {
    update(next: TactileOptions) {
      opts = next;
    },
    destroy() {
      node.removeEventListener("pointerdown", press);
      node.removeEventListener("pointerup", release);
      node.removeEventListener("pointercancel", release);
      node.removeEventListener("pointerleave", release);
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
