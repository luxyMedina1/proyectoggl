export default function HeaderLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="flex items-center justify-between bg-emphasis px-6 py-4 text-neutral">
        <span className="font-semibold">TaquillaVip</span>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="bg-darker px-6 py-4 text-neutral text-sm">
        Footer placeholder
      </footer>
    </>
  );
}
