// src/utils/clipboard.js
export async function copyToClipboard(text) {
  if (!text) return false;

  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through
    }
  }

  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);

    const selection = document.getSelection();
    const prevRange =
      selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    ta.select();
    ta.setSelectionRange(0, ta.value.length);

    const ok = document.execCommand('copy');

    document.body.removeChild(ta);
    if (prevRange && selection) {
      selection.removeAllRanges();
      selection.addRange(prevRange);
    }

    return ok;
  } catch {
    return false;
  }
}