// Shared effort scale used by both the roadmap and the known-issues page.
//
// Author types as the four-step `XS / S / M / L` scale so the source files
// stay scannable; the in-app surfaces render dots from `COMPLEXITY_DOTS`
// instead, since the letter codes don't mean anything to a reader and the
// filled-dot pattern reads as a tiny "rating out of four" at a glance.

export type Complexity = "XS" | "S" | "M" | "L";

/** Filled-of-four dots — `●●○○` is two-of-four, etc. Renders as the chip
 *  body on the roadmap and bugs pages. */
export const COMPLEXITY_DOTS: Record<Complexity, string> = {
  XS: "●○○○",
  S: "●●○○",
  M: "●●●○",
  L: "●●●●",
};

/** Human label used as the chip's `title` attribute so hover and screen
 *  readers still surface the underlying meaning. */
export const COMPLEXITY_LABEL: Record<Complexity, string> = {
  XS: "Extra small · under 15 min",
  S: "Small · under an hour",
  M: "Medium · half a day",
  L: "Large · a full day or more",
};
