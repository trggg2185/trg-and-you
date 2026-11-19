"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Headphones, X } from "lucide-react";
import GoogleSignInPanel from "@/components/GoogleSignInPanel";

const emptySubscribe = () => () => {};

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AuthModal({ open, onClose }: AuthModalProps) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  if (!open || !mounted) return null;

  return <AuthModalDialog onClose={onClose} />;
}

function AuthModalDialog({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [busy, onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={() => {
          if (!busy) onClose();
        }}
        className="animate-modal-backdrop fixed inset-0 bg-slate-900/50"
      />

      <div className="animate-modal-panel relative z-10 max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 shadow-2xl shadow-slate-900/20">
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          aria-label="Đóng"
          className="absolute right-4 top-4 rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-700 text-white shadow-sm">
            <Headphones className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Trg and you
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Đăng nhập bằng Google để lưu từ vựng, ghi chú và tiến độ học tập
          </p>
        </div>

        <GoogleSignInPanel onBusyChange={setBusy} />
      </div>
    </div>,
    document.body
  );
}
