import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
      <div className="max-w-lg text-center">
        <p className="text-sm font-semibold text-primary">404</p>
        <h1 className="mt-2 text-3xl font-bold">Page not found</h1>
        <p className="mt-3 text-muted-foreground">
          The page may have moved, or you may not have access to it.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground"
        >
          Go to home
        </Link>
      </div>
    </main>
  );
}
