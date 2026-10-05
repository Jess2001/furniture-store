import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface UiState {
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  toast: string | null;
  showToast: (message: string) => void;
}

const UiContext = createContext<UiState | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<number>();

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const value = useMemo(
    () => ({ cartOpen, setCartOpen, toast, showToast }),
    [cartOpen, toast, showToast],
  );
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi(): UiState {
  const context = useContext(UiContext);
  if (!context) throw new Error("useUi must be used inside <UiProvider>");
  return context;
}
