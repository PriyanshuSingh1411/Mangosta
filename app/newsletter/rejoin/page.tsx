import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Older "join again" links → the confirm page (same signed e / t). */
export default async function NewsletterRejoinPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string | string[]; t?: string | string[] }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (typeof params.e === "string") query.set("e", params.e);
  if (typeof params.t === "string") query.set("t", params.t);
  redirect(`/newsletter/confirm?${query.toString()}`);
}
