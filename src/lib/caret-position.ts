/**
 * Retrieves the pixel coordinates of the cursor (caret) inside a contenteditable or active document.
 * Returns null if no selection or text range is active.
 */
export interface CaretCoordinates {
  top: number;
  left: number;
  height: number;
}

export function getCaretCoordinates(): CaretCoordinates | null {
  if (typeof window === "undefined") return null;

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0).cloneRange();
  let rect: DOMRect | null = null;
  
  try {
    if (range.collapsed) {
      // Create a temporary span marker to get coordinates for the collapsed caret
      const tempSpan = document.createElement("span");
      tempSpan.appendChild(document.createTextNode("\u200b")); // Zero-width space
      range.insertNode(tempSpan);
      
      rect = tempSpan.getBoundingClientRect();
      
      // Clean up the temporary node
      const parent = tempSpan.parentNode;
      if (parent) {
        parent.removeChild(tempSpan);
      }
    } else {
      rect = range.getBoundingClientRect();
    }
  } catch (error) {
    console.warn("Failed to retrieve caret coordinates via tempSpan:", error);
  }

  if (!rect || (rect.left === 0 && rect.top === 0)) {
    return null;
  }

  return {
    top: rect.top + window.scrollY,
    left: rect.left + window.scrollX,
    height: rect.height,
  };
}
