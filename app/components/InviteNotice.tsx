export const CONTACT_URL = "https://www.huangyanming.com/contact?site=ptt";

export default function InviteNotice() {
  return (
    <section className="mb-8 overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 dark:border-amber-500/30 dark:from-amber-950/50 dark:to-orange-950/30">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <span aria-hidden className="text-2xl leading-none">
            📮
          </span>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">關鍵字通知目前是邀請制</p>
            <p className="text-sm leading-6 text-amber-800/90 dark:text-amber-200/80">
              通知會發在我的 Discord 頻道，要先加入頻道才收得到。想使用的話，寫封信告訴我你的 Discord 使用者名稱，我會把你加進去。
            </p>
          </div>
        </div>
        <a
          href={CONTACT_URL}
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 px-5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 sm:h-10"
        >
          寫信申請
        </a>
      </div>
    </section>
  );
}
