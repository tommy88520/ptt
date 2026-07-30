import Link from "next/link";
import { getSession } from "@/app/lib/session";
import { logoutAction } from "@/app/actions/subscriptions";
import LogoutButton from "@/app/components/LogoutButton";

export default async function SiteHeader() {
  const session = await getSession();

  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur dark:border-gray-800 dark:bg-gray-950/80">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-3 py-3 sm:px-4">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <svg viewBox="0 0 32 32" width="24" height="24" className="shrink-0">
            <rect width="32" height="32" rx="8" fill="#2563eb" />
            <circle cx="14" cy="14" r="6.5" fill="none" stroke="#fff" strokeWidth="2.4" />
            <line x1="18.6" y1="18.6" x2="24" y2="24" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
            <circle cx="23.5" cy="8.5" r="4" fill="#f97316" />
          </svg>
          <span className="hidden truncate text-sm font-semibold text-gray-900 sm:inline dark:text-gray-100">
            PTT MacShop 雷達
          </span>
        </Link>

        <nav className="flex shrink-0 items-center gap-3 text-xs sm:gap-4 sm:text-sm">
          <Link href="/" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">
            搜尋
          </Link>
          <Link
            href="/subscriptions"
            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            訂閱管理
          </Link>
          {session ? (
            <LogoutButton
              action={logoutAction}
              label={
                <>
                  <span className="hidden sm:inline">{session.username} · </span>登出
                </>
              }
            />
          ) : (
            <a href="/api/auth/discord" className="font-medium whitespace-nowrap text-blue-600 hover:text-blue-700">
              登入
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}
