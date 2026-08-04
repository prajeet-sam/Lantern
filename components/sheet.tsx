"use client";

import React, { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

export function Sheet({
  open,
  onClose,
  title,
  children,
  hideClose = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  hideClose?: boolean;
}) {
  const titleId = React.useId();
  const closeRef = React.useRef<HTMLButtonElement>(null);
  // trap focus-ish: prevent body scroll + close on Escape + focus the dialog
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.button
            aria-label="Close"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-label={title ? undefined : "Dialog"}
            className="absolute inset-x-0 bottom-0 mx-auto max-w-lg rounded-t-3xl border-t border-[var(--border)] bg-[var(--card)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[var(--border)]" />
            <div className="mb-3 flex items-center justify-between">
              {title && (
                <h2 id={titleId} className="font-display text-xl font-semibold text-foreground">
                  {title}
                </h2>
              )}
              {!hideClose && (
                <button
                  ref={closeRef}
                  onClick={onClose}
                  aria-label="Close"
                  className="rounded-full p-2 text-muted-foreground hover:bg-[var(--secondary)]/50"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
            <div className="max-h-[70vh] overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}