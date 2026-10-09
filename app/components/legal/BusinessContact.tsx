import type { BusinessDetails } from "@/app/data/storeTypes";
import { LegalLink } from "./LegalPage";

/**
 * Business and grievance officer details from Admin → Settings → Business
 * & legal. Fields left empty there are not shown.
 */
export default function BusinessContact({
  details,
  showGrievanceOfficer = true,
}: {
  details: BusinessDetails;
  showGrievanceOfficer?: boolean;
}) {
  const business: [string, React.ReactNode][] = [];
  if (details.legalName) business.push(["Business name", details.legalName]);
  if (details.address) business.push(["Address", <span key="a" className="whitespace-pre-line">{details.address}</span>]);
  business.push(["Email", <LegalLink key="e" href={`mailto:${details.email}`}>{details.email}</LegalLink>]);
  if (details.phone) {
    business.push(["Phone", <LegalLink key="p" href={`tel:${details.phone.replace(/[^\d+]/g, "")}`}>{details.phone}</LegalLink>]);
  }
  if (details.supportHours) business.push(["Hours", details.supportHours]);
  if (details.gstin) business.push(["GSTIN", details.gstin]);

  const officer: [string, React.ReactNode][] = [];
  if (details.grievanceOfficerName) {
    officer.push([
      "Name",
      details.grievanceOfficerDesignation
        ? `${details.grievanceOfficerName}, ${details.grievanceOfficerDesignation}`
        : details.grievanceOfficerName,
    ]);
  }
  if (details.grievanceOfficerEmail) {
    officer.push(["Email", <LegalLink key="ge" href={`mailto:${details.grievanceOfficerEmail}`}>{details.grievanceOfficerEmail}</LegalLink>]);
  }
  if (details.grievanceOfficerPhone) {
    officer.push(["Phone", <LegalLink key="gp" href={`tel:${details.grievanceOfficerPhone.replace(/[^\d+]/g, "")}`}>{details.grievanceOfficerPhone}</LegalLink>]);
  }

  const rows = (items: [string, React.ReactNode][]) => (
    // Phones: each label above its value (so emails don't break mid-word);
    // wider screens: two columns.
    <dl className="grid gap-y-3 text-sm sm:grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] sm:gap-x-4 sm:gap-y-2">
      {items.map(([label, value]) => (
        <div key={label} className="sm:contents">
          <dt className="text-xs text-stone sm:text-sm">{label}</dt>
          <dd className="mt-0.5 min-w-0 text-bone [overflow-wrap:anywhere] sm:mt-0">{value}</dd>
        </div>
      ))}
    </dl>
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="border border-line bg-charcoal p-5">
        <p className="label-technical mb-4 text-stone">CUSTOMER CARE</p>
        {rows(business)}
      </div>
      {showGrievanceOfficer && officer.length > 0 && (
        <div className="border border-line bg-charcoal p-5">
          <p className="label-technical mb-4 text-stone">GRIEVANCE OFFICER</p>
          {rows(officer)}
        </div>
      )}
    </div>
  );
}

/** Where complaints go: the grievance officer if set, otherwise customer care. */
export function grievanceEmail(details: BusinessDetails): string {
  return details.grievanceOfficerEmail || details.email;
}
