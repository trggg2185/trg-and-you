"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, HelpCircle, Loader2, X } from "lucide-react";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "primary";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  title,
  description,
  confirmText = "Xác nhận",
  cancelText = "Hủy bỏ",
  variant = "primary",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) {
        onCancel();
      }
    }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [open, loading, onCancel]);

  if (!open || !mounted) return null;

  const isDanger = variant === "danger";

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Clean dark overlay (no blur) */}
      <div
        onClick={() => {
          if (!loading) onCancel();
        }}
        className="animate-modal-backdrop fixed inset-0 bg-slate-900/50"
      />

      {/* Panel */}
      <div className="animate-modal-panel relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-900/20">
        <button
          type="button"
          disabled={loading}
          onClick={onCancel}
          aria-label="Đóng"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3.5">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
              isDanger
                ? "bg-rose-50 text-rose-600"
                : "bg-teal-50 text-teal-700"
            }`}
          >
            {isDanger ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <HelpCircle className="h-5 w-5" />
            )}
          </div>

          <div className="min-w-0 flex-1 pr-4">
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              {description}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-2.5">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="w-full sm:w-auto rounded-xl border border-slate-200 bg-white px-4 py-2.5 sm:py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl px-4 py-2.5 sm:py-2 text-sm font-semibold text-white shadow-xs transition disabled:opacity-60 cursor-pointer ${
              isDanger
                ? "bg-rose-600 hover:bg-rose-700"
                : "bg-teal-700 hover:bg-teal-800"
            }`}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
