import { vibrate } from "$lib/haptics";

type HapticPattern = "tap" | "tick" | "success" | "warn";

type TactileOptions = {
  /** Haptic pattern fired on press-down. Pass `false` to suppress. Default `"tap"`. */
  haptic?: HapticPattern | false;
};

/**
 * Press-feedback Svelte action. On pointerdown: adds `.is-pressed` for the
 * scale-down. On pointerup: removes the class AND fires the haptic IF the
 * pointer barely moved (treating it as a tap, not a scroll). Pair with a
 * `.tap-target--*` utility class for the visual scale-down.
 *
 * Why haptic on pointerup with movement check, not pointerdown — every touch
 * starts with pointerdown including the start of a scroll gesture. Firing the
 * haptic immediately means scrolling a list vibrates the phone for every card
 * we cross. Waiting for pointerup and checking that the pointer didn't move
 * means we only vibrate on real taps. The is-pressed class still fires on
 * pointerdown so visual feedback stays instant; iOS does the same — the tile
 * depresses on touch and only un-depresses (without firing the action) once
 * the system decides the gesture was a scroll.
 */
const TAP_MOVEMENT_THRESHOLD = 8;

export function tactile(node: HTMLElement, options: TactileOptions = {}) {
  let opts = options;
  let pressed = false;
  let startX = 0;
  let startY = 0;

  function press(e: PointerEvent): void {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (pressed) return;
    pressed = true;
    startX = e.clientX;
    startY = e.clientY;
    node.classList.add("is-pressed");
  }
  function release(e: PointerEvent): void {
    if (!pressed) return;
    pressed = false;
    node.classList.remove("is-pressed");
    if (opts.haptic === false) return;
    const dx = Math.abs(e.clientX - startX);
    const dy = Math.abs(e.clientY - startY);
    if (dx > TAP_MOVEMENT_THRESHOLD || dy > TAP_MOVEMENT_THRESHOLD) return;
    vibrate(opts.haptic ?? "tap");
  }
  function cancel(): void {
    if (!pressed) return;
    pressed = false;
    node.classList.remove("is-pressed");
  }
  function move(e: PointerEvent): void {
    if (!pressed) return;
    const dx = Math.abs(e.clientX - startX);
    const dy = Math.abs(e.clientY - startY);
    if (dx > TAP_MOVEMENT_THRESHOLD || dy > TAP_MOVEMENT_THRESHOLD) {
      pressed = false;
      node.classList.remove("is-pressed");
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
      node.removeEventListener("pointerdown", press);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", release);
      node.removeEventListener("pointercancel", cancel);
      node.removeEventListener("pointerleave", cancel);
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
