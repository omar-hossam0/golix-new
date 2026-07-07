export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#071B2C] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(135deg,#071B2C_0%,#07111f_46%,#071B2C_100%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(45,154,213,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(178,210,59,0.12)_1px,transparent_1px)] [background-size:72px_72px]" />
      <main className="relative min-h-dvh">
        {children}
      </main>
    </div>
  );
}
