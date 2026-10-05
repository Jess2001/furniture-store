import { useUi } from "../hooks/UiContext";

export function Toaster() {
  const { toast } = useUi();
  return (
    <div aria-live="polite" role="status" className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 px-4">
      {toast && (
        <div className="bg-inverse-surface text-inverse-on-surface px-4 py-3 font-body-sm text-body-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
