"use client";

import Link from "next/link";
import type { BusinessDetails } from "@/app/data/storeTypes";
import { adminButtonClass, adminInputClass, useStoreConfig } from "../useStoreConfig";

type Field = {
  key: keyof BusinessDetails;
  label: string;
  hint?: string;
  placeholder?: string;
  multiline?: boolean;
  type?: "email" | "tel" | "text";
};

const BUSINESS_FIELDS: Field[] = [
  { key: "legalName", label: "Legal business name", hint: "As registered, e.g. a company name or the owner's name for a proprietorship.", placeholder: "e.g. Mangosta Clothing" },
  { key: "address", label: "Business address", hint: "Full postal address.", multiline: true },
  { key: "email", label: "Customer-care email", type: "email", placeholder: "mangostateam@gmail.com" },
  { key: "phone", label: "Customer-care phone", type: "tel", placeholder: "+91 …" },
  { key: "supportHours", label: "Customer-care hours", placeholder: "e.g. Mon–Sat, 10 am – 6 pm" },
  { key: "gstin", label: "GSTIN (optional)" },
];

const GRIEVANCE_FIELDS: Field[] = [
  { key: "grievanceOfficerName", label: "Name" },
  { key: "grievanceOfficerDesignation", label: "Designation", placeholder: "e.g. Founder" },
  { key: "grievanceOfficerEmail", label: "Email", type: "email" },
  { key: "grievanceOfficerPhone", label: "Phone", type: "tel" },
];

/**
 * Admin → Settings → Business & legal. Saved separately from the other
 * settings sections (it has its own Save button).
 */
export default function BusinessDetailsSettings() {
  const { value, update, save, loading, saving, error, saved } =
    useStoreConfig<BusinessDetails>("businessDetails");

  if (loading || !value) {
    return <p className="text-sm text-stone">{error ?? "Loading…"}</p>;
  }

  const input = (field: Field) => (
    <label key={field.key} className="flex flex-col gap-1.5">
      <span className="text-xs text-bone-dim">{field.label}</span>
      {field.multiline ? (
        <textarea
          rows={3}
          value={value[field.key]}
          onChange={(event) => update({ [field.key]: event.target.value } as Partial<BusinessDetails>)}
          placeholder={field.placeholder}
          className={adminInputClass}
        />
      ) : (
        <input
          type={field.type ?? "text"}
          value={value[field.key]}
          onChange={(event) => update({ [field.key]: event.target.value } as Partial<BusinessDetails>)}
          placeholder={field.placeholder}
          className={adminInputClass}
        />
      )}
      {field.hint && <span className="text-[11px] leading-relaxed text-stone">{field.hint}</span>}
    </label>
  );

  const missing = [
    !value.legalName && "legal name",
    !value.address && "address",
    !value.phone && "customer-care phone",
    !value.grievanceOfficerName && "grievance officer",
  ].filter(Boolean) as string[];

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div>
        <p className="label-technical mb-2">BUSINESS &amp; LEGAL</p>
        <p className="text-xs leading-relaxed text-stone">
          Shown on the <Link href="/privacy" target="_blank" className="underline hover:text-bone">Privacy Policy</Link>,{" "}
          <Link href="/terms" target="_blank" className="underline hover:text-bone">Terms</Link> and{" "}
          <Link href="/faq" target="_blank" className="underline hover:text-bone">FAQ</Link> pages. Indian
          e-commerce rules ask online stores to show their legal name, address, customer-care contact and a
          grievance officer. Empty fields are left out; until they are filled in, the pages show only the
          customer-care email.
        </p>
        {missing.length > 0 && (
          <p className="mt-3 border border-mango/50 bg-mango/5 px-4 py-3 text-xs leading-relaxed text-bone-dim" role="status">
            Still to fill in: {missing.join(", ")}.
          </p>
        )}
      </div>

      <section className="flex flex-col gap-5 border border-line-strong bg-charcoal/30 p-5">
        <p className="label-technical">BUSINESS</p>
        {BUSINESS_FIELDS.map(input)}
      </section>

      <section className="flex flex-col gap-5 border border-line-strong bg-charcoal/30 p-5">
        <div>
          <p className="label-technical">GRIEVANCE OFFICER</p>
          <p className="mt-2 text-[11px] leading-relaxed text-stone">
            The person customers can write to with complaints. The pages say complaints are acknowledged
            within 48 hours and resolved within one month.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">{GRIEVANCE_FIELDS.map(input)}</div>
      </section>

      <section className="flex flex-col gap-5 border border-line-strong bg-charcoal/30 p-5">
        <p className="label-technical">DISPUTES</p>
        {input({
          key: "jurisdictionCity",
          label: "City for disputes (courts)",
          hint: "Used in the Terms: “the courts at <city> have jurisdiction”. Usually the city of your registered address.",
          placeholder: "e.g. Mumbai",
        })}
      </section>

      {error && (
        <p role="alert" className="text-sm text-mango">
          {error}
        </p>
      )}

      <div className="flex items-center gap-4">
        <button type="button" onClick={save} disabled={saving} className={adminButtonClass}>
          {saving ? "SAVING…" : "SAVE BUSINESS DETAILS"}
        </button>
        {saved && <span className="text-xs text-mango">Saved.</span>}
      </div>
    </div>
  );
}
