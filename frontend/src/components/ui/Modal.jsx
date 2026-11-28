import { useEffect } from "react";

/**
 * Modal — hộp thoại overlay.
 * Port từ docs/ui-prototype/app/src/components/ui.jsx
 *
 * @param {{ title: string, children: React.ReactNode, onClose: () => void, footer?: React.ReactNode }} props
 */
export default function Modal({ title, children, onClose, footer }) {
  useEffect(() => {
    const handler = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="modal-back"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {children}
        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  );
}
