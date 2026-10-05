import { useEffect, useRef, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
  /** "center" dialog or a "right" side drawer */
  placement?: "center" | "right";
}

export function Modal({ open, onClose, labelledBy, children, placement = "center" }: ModalProps) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    panel.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const layout =
    placement === "right" ? "justify-end" : "items-center justify-center p-4";
  const size =
    placement === "right" ? "h-full w-full max-w-md" : "w-full max-w-md max-h-[90vh]";

  return (
    <div className={`fixed inset-0 z-[60] flex ${layout}`}>
      <div className="absolute inset-0 bg-on-surface/50" onClick={onClose} data-testid="modal-backdrop" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`relative flex flex-col overflow-y-auto bg-surface outline-none ${size}`}
      >
        {children}
      </div>
    </div>
  );
}
