"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
}

interface ToastContextValue {
  showToast: (opts: {
    type: ToastType;
    message: string;
    title?: string;
    duration?: number;
  }) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const lastToastRef = useRef<{ key: string; at: number } | null>(null);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({
      type,
      message,
      title,
      duration = 4200,
    }: {
      type: ToastType;
      message: string;
      title?: string;
      duration?: number;
    }) => {
      const dedupeKey = `${type}:${title ?? ""}:${message}`;
      const now = Date.now();
      if (
        lastToastRef.current &&
        lastToastRef.current.key === dedupeKey &&
        now - lastToastRef.current.at < 350
      ) {
        return;
      }
      lastToastRef.current = { key: dedupeKey, at: now };

      const id = `${now}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((prev) => [...prev.slice(-4), { id, type, title, message }]);

      if (duration > 0) {
        setTimeout(() => {
          dismiss(id);
        }, duration);
      }
    },
    [dismiss]
  );

  const success = useCallback(
    (message: string, title?: string) =>
      showToast({ type: "success", message, title }),
    [showToast]
  );
  const error = useCallback(
    (message: string, title?: string) =>
      showToast({ type: "error", message, title }),
    [showToast]
  );
  const info = useCallback(
    (message: string, title?: string) =>
      showToast({ type: "info", message, title }),
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, success, error, info }}>
      {children}

      {/* Toast Container (slides in from right to left) */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 top-3 z-50 flex flex-col gap-2.5 sm:inset-x-auto sm:right-6 sm:top-6 sm:w-full sm:max-w-sm"
      >
        {toasts.map((toast) => {
          const styles =
            toast.type === "success"
              ? {
                  border: "border-emerald-200/90 bg-white",
                  iconWrap: "bg-emerald-50 text-emerald-700",
                  Icon: CheckCircle2,
                  defaultTitle: "Thành công",
                }
              : toast.type === "error"
              ? {
                  border: "border-rose-200/90 bg-white",
                  iconWrap: "bg-rose-50 text-rose-700",
                  Icon: AlertCircle,
                  defaultTitle: "Có lỗi xảy ra",
                }
              : {
                  border: "border-teal-200/90 bg-white",
                  iconWrap: "bg-teal-50 text-teal-700",
                  Icon: Info,
                  defaultTitle: "Thông báo",
                };

          const Icon = styles.Icon;

          return (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto animate-toast-in flex items-start gap-3 rounded-2xl border ${styles.border} p-3.5 shadow-lg shadow-slate-900/8 backdrop-blur`}
            >
              <div
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${styles.iconWrap}`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-900">
                  {toast.title ?? styles.defaultTitle}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                  {toast.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Đóng thông báo"
                className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
