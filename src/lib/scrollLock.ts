/**
 * Stops the page behind a sheet or full-screen view from scrolling. Sheets open on top of each other (a photo over
 * Compare over Health), so this counts them: the page is released only when the last one closes, whatever order
 * they close in.
 */
let locks = 0;
let before = "";

/** Lock the page; call the returned function to let go. */
export function lockScroll(): () => void {
  if (locks++ === 0) {
    before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--locks === 0) document.body.style.overflow = before;
  };
}
