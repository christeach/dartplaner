import { useEffect, useId, useRef, type ReactNode } from 'react';

interface Props { title: string; onClose(): void; children: ReactNode }

/** Native modal <dialog>; mount to open, unmount to close. Focus goes back to the element that opened it. */
export function Modal({ title, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  // captured on first render, before showModal moves focus into the dialog
  const opener = useRef(document.activeElement as HTMLElement | null);
  const id = useId();
  useEffect(() => {
    const d = ref.current!;
    if (!d.open) d.showModal();
    return () => {
      d.close();
      // the opener may be gone (e.g. the board tile changed); then fall back to the page heading
      const o = opener.current;
      (o?.isConnected ? o : document.getElementById('shell-title'))?.focus();
    };
  }, []);
  return (
    <dialog ref={ref} className="dialog" aria-labelledby={id} onCancel={(e) => { e.preventDefault(); onClose(); }}>
      <h2 id={id}>{title}</h2>
      {children}
    </dialog>
  );
}

interface ConfirmProps { title: string; text: string; confirm: string; onConfirm(): void; onClose(): void }

export function ConfirmDialog({ title, text, confirm, onConfirm, onClose }: ConfirmProps) {
  return (
    <Modal title={title} onClose={onClose}>
      <p>{text}</p>
      <div className="dialog-actions">
        <button type="button" className="btn" onClick={onClose}>Abbrechen</button>
        <button type="button" className="btn btn-primary" onClick={() => { onConfirm(); onClose(); }}>{confirm}</button>
      </div>
    </Modal>
  );
}
