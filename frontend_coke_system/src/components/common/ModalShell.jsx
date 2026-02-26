import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const SIZE_CLASS_MAP = {
  sm: "app-modal-panel-sm",
  md: "app-modal-panel-md",
  lg: "app-modal-panel-lg",
  xl: "app-modal-panel-xl",
  "2xl": "app-modal-panel-2xl",
};

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']",
].join(",");

const getFocusableElements = (container) => {
  if (!container) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => {
    const style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
  });
};

const focusSafely = (el) => {
  if (!el || typeof el.focus !== "function") return;
  try {
    el.focus({ preventScroll: true });
  } catch {
    el.focus();
  }
};

const ModalShell = ({
  open = true,
  onClose,
  children,
  size = "md",
  overlayClassName = "",
  panelClassName = "",
  closeOnOverlay = true,
  closeOnEscape = true,
  trapFocus = true,
  initialFocusRef = null,
  initialFocusSelector = null,
  role = "dialog",
  ariaLabel,
  ariaLabelledBy,
  zIndexClass = "z-50",
}) => {
  const panelRef = useRef(null);
  const previousActiveElementRef = useRef(null);

  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;

    previousActiveElementRef.current = document.activeElement;
    const rafId = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;

      if (initialFocusRef?.current) {
        focusSafely(initialFocusRef.current);
        return;
      }

      if (initialFocusSelector) {
        const target = panel.querySelector(initialFocusSelector);
        if (target) {
          focusSafely(target);
          return;
        }
      }

      const firstFocusable = getFocusableElements(panel)[0];
      focusSafely(firstFocusable || panel);
    });

    return () => {
      window.cancelAnimationFrame(rafId);
      focusSafely(previousActiveElementRef.current);
    };
  }, [open, initialFocusRef, initialFocusSelector]);

  if (!open || typeof document === "undefined") return null;

  const panelSizeClass = SIZE_CLASS_MAP[size] || "";
  const handlePanelKeyDown = (e) => {
    if (!panelRef.current) return;

    if (e.key === "Escape" && closeOnEscape) {
      e.stopPropagation();
      onClose?.();
      return;
    }

    if (e.key !== "Tab" || !trapFocus) return;

    const focusables = getFocusableElements(panelRef.current);
    if (focusables.length === 0) {
      e.preventDefault();
      focusSafely(panelRef.current);
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (e.shiftKey) {
      if (active === first || active === panelRef.current) {
        e.preventDefault();
        focusSafely(last);
      }
      return;
    }

    if (active === last) {
      e.preventDefault();
      focusSafely(first);
    }
  };

  return createPortal(
    <div
      className={`app-modal-overlay ${zIndexClass} ${overlayClassName}`.trim()}
      onClick={(e) => {
        if (e.target === e.currentTarget && closeOnOverlay) {
          onClose?.();
        }
      }}
      role="presentation"
    >
      <div
        ref={panelRef}
        className={`app-modal-panel ${panelSizeClass} ${panelClassName}`.trim()}
        tabIndex={-1}
        role={role}
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        onKeyDown={handlePanelKeyDown}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};

export default ModalShell;
