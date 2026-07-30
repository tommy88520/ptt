export function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 flex-1 w-full">
      <h1 className="text-2xl font-semibold tracking-tight mb-1">{title}</h1>
      <p className="text-xs text-gray-400 mb-4">最後更新：{updated}</p>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-8">{intro}</p>
      <div className="flex flex-col gap-6">{children}</div>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">{title}</h2>
      <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed flex flex-col gap-2">{children}</div>
    </section>
  );
}

export function LegalList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc pl-5 flex flex-col gap-1">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
