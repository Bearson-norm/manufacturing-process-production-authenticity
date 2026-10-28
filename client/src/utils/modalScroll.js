/** Scroll a section into view inside a production large-modal body. */
export function scrollProductionModalSection(elementId) {
  const el = document.getElementById(elementId);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
