"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export default function LogoutButton({ action, label }: { action: () => void; label: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Portal target (document.body) only exists on the client.
  useEffect(() => setMounted(true), []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-gray-500 hover:text-gray-900 dark:text-gray-500 dark:hover:text-gray-100"
      >
        {label}
      </button>

      {open &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
            onClick={() => setOpen(false)}
          >
            <div
              className="w-full max-w-xs rounded-xl bg-white p-5 shadow-xl dark:bg-gray-900"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">確定要登出嗎？</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                登出後要重新用 Discord 登入才能管理訂閱。
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => action()}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                >
                  登出
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
