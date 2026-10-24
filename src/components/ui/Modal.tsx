// src/components/ui/Modal.tsx
"use client";

// نافذة منبثقة (Modal) بسيطة: Escape بيقفلها، والتركيز بيروح لزرار القفل أول ما تفتح.
import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

interface ModalProps {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  onClose: () => void;
  size?: "sm" | "lg";
  children: ReactNode;
}

export function Modal({ title, subtitle, icon, onClose, size = "sm", children }: ModalProps) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="modal" role="presentation">
      <button type="button" className="modal__scrim" aria-label="قفل" onClick={onClose} />
      <section className={`modal__panel modal__panel--${size}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="drawer__head">
          <div className="drawer__title">
            {icon && (
              <span className="card__icon" aria-hidden="true">
                {icon}
              </span>
            )}
            <div>
              <h2 id={titleId}>{title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </div>
          </div>
          <button ref={closeRef} type="button" className="icon-btn" onClick={onClose} aria-label="قفل">
            <X size={18} />
          </button>
        </header>
        <div className="modal__body">{children}</div>
      </section>
    </div>
  );
}
