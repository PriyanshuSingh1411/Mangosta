import Link from "next/link";
import Navigation from "./components/Navigation";
export default function NotFound() {
  return (
    <>
      <Navigation />
      <main
        id="main-content"
        className="flex min-h-screen items-center justify-center bg-void px-6 pt-20 text-center"
      >
        <div>
          <p className="label-technical text-mango">404 / PAGE NOT FOUND</p>
          <h1 className="mt-4 type-display text-bone">LOST IN THE WILD.</h1>
          <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-stone">
            This page has moved, disappeared, or never existed.
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex border border-line-strong px-6 py-3 text-xs tracking-[0.16em] text-bone hover:border-bone"
          >
            BACK HOME
          </Link>
        </div>
      </main>
    </>
  );
}
