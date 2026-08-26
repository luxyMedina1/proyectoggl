export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center bg-neutral px-4 py-16">
      {children}
    </main>
  );
}
