import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="border-t border-gray-200 py-6 dark:border-gray-800">
      <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 text-xs text-gray-400">
        <span>PTT MacShop 雷達</span>
        <Link href="/terms" className="hover:text-gray-600 dark:hover:text-gray-300">
          使用條款
        </Link>
        <Link href="/privacy" className="hover:text-gray-600 dark:hover:text-gray-300">
          隱私權政策
        </Link>
        <a
          href="https://github.com/tommy88520/ptt"
          target="_blank"
          rel="noreferrer"
          className="hover:text-gray-600 dark:hover:text-gray-300"
        >
          GitHub
        </a>
      </div>
    </footer>
  );
}
