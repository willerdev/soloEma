"use client";

import { X } from "lucide-react";
import { MetaApiAccountPicker } from "@/components/mt5/metaapi-account-picker";

type Props = {
  open: boolean;
  onClose: () => void;
  onLinked: () => void;
};

export function TradingConnectDialog({ open, onClose, onLinked }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-900/45 p-3 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Connect trading account
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Paste your MetaAPI API token and the account ID you want to
              monitor. No MT5 login or password.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="text-slate-800 [&_.text-white]:text-slate-900 [&_.text-muted]:text-slate-500 [&_.text-success]:text-emerald-600 [&_.text-danger]:text-red-600 [&_.bg-card]:bg-slate-50 [&_.border-\[var\(--color-border\)\]]:border-slate-200">
          <MetaApiAccountPicker
            showTokenField
            onLinked={() => {
              onLinked();
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
