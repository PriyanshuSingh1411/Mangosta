import type { Metadata } from "next";
import Link from "next/link";
import Navigation from "@/app/components/Navigation";
import Footer from "@/app/components/Footer";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with Mangosta.",
};

const INSTAGRAM_URL =
  "https://www.instagram.com/mangosta_clothing?stkn=MWYzZjRwdG9ycmlzaQ==";

export default function ContactPage() {
  return (
    <>
      <Navigation />

      <main
        id="main-content"
        className="min-h-screen bg-void px-5 pb-24 pt-[120px] sm:px-8 sm:pt-[150px]"
      >
        <div className="mx-auto max-w-[1400px]">
          <div className="border-b border-line pb-8 sm:pb-12">
            <p className="label-technical mb-4 text-stone">
              06 — CONTACT
            </p>
            <h1 className="font-display text-[15vw] uppercase leading-[0.82] tracking-[-0.05em] text-bone sm:text-[8rem] lg:text-[10rem]">
              LET&apos;S
              <br />
              TALK.
            </h1>
          </div>

          <div className="grid grid-cols-1 gap-12 py-14 sm:py-20 lg:grid-cols-[1.2fr_0.8fr] lg:gap-24">
            <div>
              <p className="max-w-2xl text-base leading-7 text-bone-dim sm:text-lg sm:leading-8">
                Have a question about an order, a product, or Mangosta in
                general? Drop us a message and we&apos;ll get back to you.
              </p>

              <a
                href="mailto:mangostateam@gmail.com"
                className="mt-8 inline-flex border border-line-strong px-5 py-4 text-xs font-medium uppercase tracking-[0.16em] text-bone transition-colors hover:border-bone hover:bg-bone hover:text-void"
              >
                EMAIL MANGOSTA →
              </a>
            </div>

            <div className="border-t border-line pt-6 lg:border-t-0 lg:border-l lg:pl-10">
              <p className="label-technical mb-4 text-stone">
                DIRECT CONTACT
              </p>

              <a
                href="mailto:mangostateam@gmail.com"
                className="block text-lg text-bone transition-colors hover:text-mango"
              >
                mangostateam@gmail.com
              </a>

              <p className="label-technical mb-4 mt-10 text-stone">
                SOCIAL
              </p>

              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm tracking-[0.16em] text-bone transition-colors hover:text-mango"
              >
                INSTAGRAM →
              </a>

              <Link
                href="/#trending"
                className="mt-10 inline-block text-xs font-medium uppercase tracking-[0.16em] text-stone transition-colors hover:text-bone"
              >
                EXPLORE TRENDING →
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
