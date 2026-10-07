"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

/* ==========================================================================
 * Types (mirror the /api/admin/user-engagement/* responses)
 * ========================================================================== */

type Period = {
  range: string;
  label: string;
  start: string;
  end: string;
  timeZone: string;
};

type SegmentDefinition = {
  key: string;
  label: string;
  scope: "lifetime" | "period";
  description: string;
};

type CustomerRow = {
  key: string;
  userId: string | null;
  isGuest: boolean;
  name: string;
  email: string;
  mobile: string;
  joinedAt: string | null;
  firstActiveAt: string | null;
  lastActiveAt: string | null;
  period: {
    active: boolean;
    sessions: number;
    productViews: number;
    wishlistAdds: number;
    cartAdds: number;
    checkoutStarts: number;
    orders: number;
    revenue: number;
    lastActiveAt: string | null;
  };
  lifetime: {
    orders: number;
    revenue: number;
    averageOrderValue: number;
    firstOrderAt: string | null;
    lastOrderAt: string | null;
  };
  engagementScore: number;
  segment: { key: string; label: string };
  segments: string[];
};

type TrendPoint = {
  date: string;
  activeUsers: number;
  visitors: number;
  sessions: number;
  productViews: number;
  wishlistAdds: number;
  cartAdds: number;
  checkoutStarts: number;
  orders: number;
  revenue: number;
};

type OverviewData = {
  period: Period;
  summary: {
    totalUsers: number;
    activeUsers: number;
    newUsers: number;
    returningUsers: number;
    engagedUsers: number;
    visitors: number;
    sessions: number;
    productViews: number;
    wishlistAdds: number;
    cartAdds: number;
    checkoutStarts: number;
    orders: number;
    revenue: number;
    averageOrderValue: number;
    orderingVisitors: number;
    visitorConversionRate: number;
  };
  funnel: {
    activeVisitors: number;
    productViewers: number;
    wishlistCustomers: number;
    cartCustomers: number;
    checkoutCustomers: number;
    purchasingCustomers: number;
    viewersWhoWishlisted: number;
    viewersWhoCarted: number;
    cartersWhoCheckedOut: number;
    cartersWhoOrdered: number;
    checkoutsWhoOrdered: number;
  };
  trend: TrendPoint[];
  activity: CustomerRow[];
  definitions: Record<string, string>;
};

type CustomerListData = {
  period: Period;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  customers: CustomerRow[];
  segmentDefinitions: SegmentDefinition[];
  definitions: Record<string, string>;
};

type SegmentCriteria = {
  minViews: number;
  minWishlist: number;
  minCart: number;
  minOrders: number;
  minRevenue: number;
  inactiveDays: number;
  segment: string;
};

type SavedSegment = {
  id: string;
  name: string;
  criteria: SegmentCriteria;
  createdAt: string | null;
  updatedAt: string | null;
};

type SegmentsData = {
  period: Period;
  criteria: SegmentCriteria;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  customers: CustomerRow[];
  summary: {
    activeCustomers: number;
    averageScore: number;
    highlyEngaged: number;
    highValue: number;
    cartAbandoners: number;
    segments: (SegmentDefinition & { customers: number; share: number })[];
    mostEngaged: CustomerRow[];
  };
  segmentDefinitions: SegmentDefinition[];
  savedSegments: SavedSegment[];
  definitions: Record<string, string>;
};

type FeatureUsageData = {
  period: Period;
  totalEvents: number;
  features: {
    key: string;
    label: string;
    description: string;
    uses: number;
    uniqueUsers: number;
    uniqueSessions: number;
    usesWithoutSession: number;
    breakdown: { event: string; label: string; count: number }[];
  }[];
};

type RetentionData = {
  period: Period;
  summary: {
    totalCustomers: number;
    returnedCustomers: number;
    notReturnedCustomers: number;
    returnRate: number;
    repeatBuyers: number;
    repeatBuyerRate: number;
  };
  retention: { day: number; eligible: number; retained: number; rate: number }[];
  cohorts: {
    date: string;
    customers: number;
    day7: number | null;
    day14: number | null;
    day30: number | null;
  }[];
  definitions: Record<string, string>;
};

type ValueGroup = {
  label: string;
  customers: number;
  revenue: number;
  averageValue: number;
};

type LtvData = {
  period: Period;
  lifetime: {
    payingCustomers: number;
    registeredCustomers: number;
    guestCustomers: number;
    lifetimeRevenue: number;
    lifetimeOrders: number;
    customerLifetimeValue: number;
    averageOrderValue: number;
    averageOrdersPerCustomer: number;
    repeatBuyers: number;
    repeatPurchaseRate: number;
    oneTimeBuyers: number;
    highValueCustomers: number;
  };
  periodSummary: {
    buyers: number;
    orders: number;
    revenue: number;
    averageOrderValue: number;
    newBuyers: number;
    returningBuyers: number;
  };
  purchaseFrequency: ValueGroup[];
  customerTypes: ValueGroup[];
  periodBuyerTypes: ValueGroup[];
  topCustomers: {
    key: string;
    userId: string | null;
    isGuest: boolean;
    name: string;
    email: string;
    orders: number;
    revenue: number;
    averageOrderValue: number;
    firstPurchaseAt: string | null;
    lastPurchaseAt: string | null;
  }[];
  definitions: Record<string, string>;
};

type SearchData = {
  period: Period;
  summary: {
    totalSearches: number;
    uniqueQueries: number;
    searchesWithResults: number;
    zeroResultSearches: number;
    resultRate: number;
    zeroResultRate: number;
    searchSessions: number;
    searchUsers: number;
    searchesPerSession: number;
    sessionsWithView: number;
    sessionsWithCart: number;
    sessionsWithOrder: number;
    searchToViewRate: number;
    searchToCartRate: number;
    searchToOrderRate: number;
    attributedOrders: number;
    attributedRevenue: number;
  };
  topQueries: {
    query: string;
    searches: number;
    sessions: number;
    users: number;
    resultRate: number;
    zeroResultSearches: number;
    viewRate: number;
    cartRate: number;
    orderRate: number;
    orders: number;
    revenue: number;
  }[];
  zeroResultQueries: {
    query: string;
    searches: number;
    sessions: number;
    zeroResultSearches: number;
    zeroResultRate: number;
  }[];
  trend: {
    date: string;
    searches: number;
    uniqueQueries: number;
    zeroResults: number;
    searchSessions: number;
  }[];
  definitions: Record<string, string>;
};

type ProductRow = {
  productId: string;
  name: string;
  category: string;
  image: string;
  inCatalog: boolean;
  views: number;
  uniqueViewers: number;
  wishlistRate: number;
  cartRate: number;
  conversionRate: number;
  viewersWhoBought: number;
  buyers: number;
  wishlistAdds: number;
  cartAdds: number;
  shares: number;
  unitsSold: number;
  orders: number;
  revenue: number;
  engagementScore: number;
};

type CategoryRow = Omit<
  ProductRow,
  "productId" | "name" | "image" | "inCatalog" | "engagementScore"
> & { products: number; activeProducts: number };

type ProductData = {
  period: Period;
  totals: {
    views: number;
    uniqueViewers: number;
    wishlistAdds: number;
    cartAdds: number;
    shares: number;
    unitsSold: number;
    orders: number;
    productRevenue: number;
    orderRevenue: number;
    shippingRevenue: number;
    conversionRate: number;
    viewersWhoBought: number;
  };
  products: ProductRow[];
  categories: CategoryRow[];
  mostEngaged: ProductRow[];
  mostViewed: ProductRow[];
  mostWishlisted: ProductRow[];
  mostAddedToCart: ProductRow[];
  mostPurchased: ProductRow[];
  highestRevenue: ProductRow[];
  highInterestLowConversion: ProductRow[];
  categoryDropOff: CategoryRow[];
  definitions: Record<string, string>;
};

type TimelineEvent = {
  id: string;
  event: string;
  createdAt: string | null;
  productId: string;
  productName: string;
  searchQuery: string;
  path: string;
  details: Record<string, string | number | boolean>;
};

type TimelinePage = {
  events: TimelineEvent[];
  total: number;
  offset: number;
  nextOffset: number | null;
  asOf: string;
};

type ProfileData = {
  period: Period;
  customer: {
    key: string;
    id: string;
    isGuest: boolean;
    email: string;
    firstName: string;
    lastName: string;
    name: string;
    mobile: string;
    createdAt: string | null;
    lastLoginAt: string | null;
    emailVerified: boolean;
  };
  summary: {
    firstActivityAt: string | null;
    lastActiveAt: string | null;
    joinedAt: string | null;
    lifetime: {
      events: number;
      sessions: number;
      productViews: number;
      wishlistAdds: number;
      cartAdds: number;
      checkoutStarts: number;
      searches: number;
      orders: number;
      revenue: number;
      averageOrderValue: number;
      cancelledOrders: number;
      firstOrderAt: string | null;
      lastOrderAt: string | null;
    };
    period: CustomerRow["period"];
    ltv: number;
    engagementScore: number;
    segment: { key: string; label: string };
    segments: string[];
  };
  wishlist: {
    productId: string;
    name: string;
    slug: string;
    folder: string;
    addedAt: string;
    priceAtSave: number;
  }[];
  viewedProducts: {
    productId: string;
    name: string;
    slug: string;
    views: number;
    lastViewedAt: string | null;
  }[];
  orders: {
    id: string;
    createdAt: string;
    status: string;
    paymentStatus: string;
    countsAsRevenue: boolean;
    total: number;
    itemCount: number;
    lines: { productId: string; productName: string; quantity: number; price: number }[];
  }[];
  timeline: TimelinePage;
  segmentDefinitions: SegmentDefinition[];
  definitions: Record<string, string>;
};

/** Who to open in the profile: an account, or a guest buyer by email. */
type ProfileTarget = { userId?: string | null; email?: string | null };

export type UserAnalyticsSection =
  | "overview"
  | "feature-usage"
  | "profiles"
  | "segments"
  | "retention"
  | "ltv"
  | "search"
  | "product-discovery";

/* ==========================================================================
 * Formatting
 * ========================================================================== */

const TIME_ZONE = "Asia/Kolkata";

const numberFormat = new Intl.NumberFormat("en-IN");
const currencyFormat = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: TIME_ZONE,
});
const dateTimeFormat = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});
const dayKeyFormat = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatNumber(value: number) {
  return numberFormat.format(Number.isFinite(value) ? value : 0);
}

function formatCurrency(value: number) {
  return currencyFormat.format(Number.isFinite(value) ? value : 0);
}

function formatPercent(value: number) {
  return `${(Number.isFinite(value) ? value : 0).toFixed(1)}%`;
}

/** "1 session" / "3 sessions" (number formatted for India). */
function countOf(value: number, singular: string, plural = `${singular}s`) {
  return `${formatNumber(value)} ${value === 1 ? singular : plural}`;
}

function share(part: number, whole: number) {
  return whole > 0 ? (part / whole) * 100 : 0;
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value: string | null | undefined) {
  const date = parseDate(value);
  return date ? dateFormat.format(date) : "—";
}

function formatDateTime(value: string | null | undefined) {
  const date = parseDate(value);
  return date ? dateTimeFormat.format(date) : "—";
}

/** "2026-10-07" (an India calendar day) → "07 Oct 2026". */
function formatDayKey(key: string) {
  const date = parseDate(`${key}T00:00:00Z`);
  return date ? dayKeyFormat.format(date) : key;
}

function humanizeEvent(event: string) {
  return event.replaceAll("_", " ");
}

/* ==========================================================================
 * Data loading
 * ========================================================================== */

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { cache: "no-store", signal });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || "Unable to load analytics.");
  }
  return data as T;
}

/**
 * Loads JSON for `url`. `data` belongs to the current url only; `lastData`
 * keeps the previous result on screen while the next one loads.
 */
function useAnalyticsData<T>(url: string | null, refreshToken = 0) {
  const key = url ? `${url}::${refreshToken}` : "";
  const [state, setState] = useState<{
    key: string;
    data: T | null;
    error: string | null;
  }>({ key: "", data: null, error: null });

  useEffect(() => {
    if (!url) return;

    const controller = new AbortController();
    const requestKey = `${url}::${refreshToken}`;

    fetchJson<T>(url, controller.signal)
      .then((data) => setState({ key: requestKey, data, error: null }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState((current) => ({
          key: requestKey,
          data: current.data,
          error: error instanceof Error ? error.message : "Unable to load analytics.",
        }));
      });

    return () => controller.abort();
  }, [url, refreshToken]);

  const current = state.key === key && key !== "";

  return {
    data: current && !state.error ? state.data : null,
    lastData: state.data,
    error: current ? state.error : null,
    loading: key !== "" && !current,
  };
}

/** Value that follows `value` after it stops changing for `delay` ms. */
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

function rangeQuery(range: string) {
  return `range=${encodeURIComponent(range)}`;
}

/* ==========================================================================
 * Shared UI
 * ========================================================================== */

const DATE_OPTIONS = [
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "Last 7 Days", value: "7d" },
  { label: "Last 30 Days", value: "30d" },
  { label: "This Month", value: "month" },
];

const SECTION_CONFIG: Record<
  UserAnalyticsSection,
  { eyebrow: string; title: string; description: string }
> = {
  overview: {
    eyebrow: "ANALYTICS / CUSTOMER BEHAVIOUR",
    title: "User Engagement",
    description:
      "How customers discover products, interact with the store and move from browsing to an order. Revenue and orders come from your orders; behaviour comes from tracked activity.",
  },
  "feature-usage": {
    eyebrow: "USER / FEATURE USAGE",
    title: "Feature Usage",
    description: "Which Mangosta features customers actually use, by uses, customers and sessions.",
  },
  profiles: {
    eyebrow: "USER / CUSTOMER PROFILES",
    title: "Customer Profiles",
    description:
      "Search every customer — accounts and guest buyers — and open a complete profile with full order and activity history.",
  },
  segments: {
    eyebrow: "USER / CUSTOMER SEGMENTS",
    title: "Customer Segments",
    description:
      "Turn selected-period behaviour and lifetime value into actionable, savable customer audiences.",
  },
  retention: {
    eyebrow: "USER / RETENTION",
    title: "Retention",
    description:
      "How many customers come back after their first-ever activity, and how each first-activity cohort performs over time.",
  },
  ltv: {
    eyebrow: "USER / CUSTOMER LTV",
    title: "Customer LTV",
    description:
      "Lifetime value of every customer who has ever ordered, plus what happened in the selected period.",
  },
  search: {
    eyebrow: "USER / SEARCH ANALYTICS",
    title: "Search Analytics",
    description:
      "What customers search for, whether they find it, and how search sessions turn into views, bag adds and orders.",
  },
  "product-discovery": {
    eyebrow: "USER / PRODUCT DISCOVERY",
    title: "Product Discovery",
    description:
      "Product and category attention, intent and conversion — counted by unique visitors so rates never pass 100%.",
  },
};

function StatCard({
  label,
  value,
  description,
  loading,
}: {
  label: string;
  value: string;
  description?: string;
  loading?: boolean;
}) {
  return (
    <div className="bg-charcoal p-5">
      <p className="label-technical text-stone">{label}</p>
      <p className="mt-4 break-words font-display text-2xl tracking-tight text-bone sm:text-3xl">
        {loading ? "—" : value}
      </p>
      {description && (
        <p className="mt-2 text-xs leading-relaxed text-stone">{description}</p>
      )}
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="label-technical text-stone">{eyebrow}</p>
        <h2 className="mt-2 font-display text-2xl text-bone">{title}</h2>
        {description && (
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-stone">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  // min-w-0 lets a panel shrink inside grid columns; wide tables scroll
  // inside their own overflow-x container instead of widening the page.
  return <div className={`min-w-0 border border-line bg-charcoal ${className}`}>{children}</div>;
}

function PanelHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-line p-6 sm:flex-row sm:items-start sm:justify-between sm:p-8">
      <div>
        <p className="label-technical text-stone">{eyebrow}</p>
        <h3 className="mt-2 font-display text-xl text-bone sm:text-2xl">{title}</h3>
        {description && (
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-stone">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

function Bar({ value }: { value: number }) {
  return (
    <div className="mt-3 h-1 bg-void">
      <div
        className="h-full bg-mango transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-6 py-12 text-center text-sm text-stone">
        {children}
      </td>
    </tr>
  );
}

function Th({ children, align = "left" }: { children: ReactNode; align?: "left" | "right" }) {
  return (
    <th
      className={`px-4 py-4 label-technical text-stone first:pl-6 last:pr-6 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function GuestTag() {
  return (
    <span className="ml-2 inline-block border border-line-strong px-1.5 py-0.5 align-middle font-mono text-[9px] tracking-[0.12em] text-stone">
      GUEST
    </span>
  );
}

function ScopeTag({ scope }: { scope: "lifetime" | "period" }) {
  return (
    <span
      className={`inline-block border px-1.5 py-0.5 font-mono text-[9px] tracking-[0.12em] ${
        scope === "lifetime" ? "border-mango/50 text-mango" : "border-line-strong text-stone"
      }`}
    >
      {scope === "lifetime" ? "LIFETIME" : "PERIOD"}
    </span>
  );
}

function CustomerCell({ customer }: { customer: Pick<CustomerRow, "name" | "email" | "isGuest" | "userId" | "mobile"> }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-sm text-bone">
        {customer.name}
        {customer.isGuest && <GuestTag />}
      </p>
      <p className="mt-1 truncate font-mono text-[10px] text-stone">
        {customer.email || customer.mobile || customer.userId || "—"}
      </p>
    </div>
  );
}

/** Keyboard + mouse activation for clickable table rows. */
function rowProps(onOpen: () => void) {
  return {
    onClick: onOpen,
    onKeyDown: (event: ReactKeyboardEvent<HTMLTableRowElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onOpen();
      }
    },
    tabIndex: 0,
    role: "button" as const,
    className:
      "cursor-pointer border-b border-line last:border-0 outline-none transition-colors hover:bg-void/40 focus-visible:bg-void/40",
  };
}

function targetOf(customer: { userId: string | null; email: string; isGuest: boolean }): ProfileTarget {
  return customer.isGuest ? { email: customer.email } : { userId: customer.userId };
}

function ErrorNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="mt-6 border border-mango/40 bg-mango/5 px-5 py-4">
      <p className="text-sm text-mango">{message}</p>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  total,
  limit,
  onPage,
  loading,
  noun,
}: {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPage: (page: number) => void;
  loading?: boolean;
  noun: string;
}) {
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);

  return (
    <div className="flex flex-col gap-3 border-t border-line px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="font-mono text-[11px] text-stone">
        {loading ? "Updating…" : `Showing ${formatNumber(from)}–${formatNumber(to)} of ${formatNumber(total)} ${noun}`}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1 || loading}
          className="border border-line-strong px-3 py-2 text-[10px] tracking-[0.14em] text-bone transition-colors hover:border-bone disabled:cursor-not-allowed disabled:opacity-40"
        >
          PREV
        </button>
        <span className="px-2 font-mono text-[11px] text-stone">
          {formatNumber(page)} / {formatNumber(totalPages)}
        </span>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages || loading}
          className="border border-line-strong px-3 py-2 text-[10px] tracking-[0.14em] text-bone transition-colors hover:border-bone disabled:cursor-not-allowed disabled:opacity-40"
        >
          NEXT
        </button>
      </div>
    </div>
  );
}

const selectClass =
  "mt-2 w-full border border-line bg-void px-3 py-2 text-sm text-bone outline-none focus:border-mango";

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="label-technical text-stone">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={selectClass}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ==========================================================================
 * Page
 * ========================================================================== */

export default function UserEngagementPage({
  section = "overview",
}: {
  section?: UserAnalyticsSection;
}) {
  const config = SECTION_CONFIG[section];
  const [range, setRange] = useState("30d");
  const [profileTarget, setProfileTarget] = useState<ProfileTarget | null>(null);

  const openProfile = (target: ProfileTarget) => {
    if (target.userId || target.email) setProfileTarget(target);
  };

  return (
    <div className="min-h-screen bg-void">
      <div className="mx-auto max-w-[1600px] px-5 py-8 sm:px-8 lg:px-10">
        <div className="flex flex-col gap-6 border-b border-line pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="label-technical mb-3 text-mango">{config.eyebrow}</p>
            <h1 className="font-display text-4xl tracking-tight text-bone sm:text-5xl">{config.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone">{config.description}</p>
          </div>

          <div className="flex flex-col gap-2 lg:items-end">
            <div className="flex flex-wrap gap-2">
              {DATE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRange(option.value)}
                  aria-pressed={range === option.value}
                  className={
                    range === option.value
                      ? "border border-bone bg-bone px-4 py-2 text-xs font-medium tracking-[0.12em] text-void"
                      : "border border-line-strong px-4 py-2 text-xs font-medium tracking-[0.12em] text-stone transition-colors hover:border-stone hover:text-bone"
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="font-mono text-[10px] text-stone-dark">All dates in India time (IST)</p>
          </div>
        </div>

        {section === "overview" && <OverviewSection range={range} onOpenProfile={openProfile} />}
        {section === "feature-usage" && <FeatureUsageSection range={range} />}
        {section === "profiles" && <ProfilesSection range={range} onOpenProfile={openProfile} />}
        {section === "segments" && <SegmentsSection range={range} onOpenProfile={openProfile} />}
        {section === "retention" && <RetentionSection range={range} />}
        {section === "ltv" && <LtvSection range={range} onOpenProfile={openProfile} />}
        {section === "search" && <SearchSection range={range} />}
        {section === "product-discovery" && <ProductDiscoverySection range={range} />}
      </div>

      {profileTarget && (
        <CustomerProfileModal
          key={`${profileTarget.userId ?? ""}|${profileTarget.email ?? ""}|${range}`}
          target={profileTarget}
          range={range}
          onClose={() => setProfileTarget(null)}
        />
      )}
    </div>
  );
}

/* ==========================================================================
 * Overview
 * ========================================================================== */

function FunnelStage({
  label,
  value,
  total,
  note,
  first,
}: {
  label: string;
  value: number;
  total: number;
  note?: string;
  first?: boolean;
}) {
  const ofTotal = share(value, total);

  return (
    <div className="border-b border-line py-5 last:border-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-bone">{label}</p>
          <p className="mt-1 text-xs text-stone">
            {first ? "Starting audience" : `${formatPercent(ofTotal)} of active visitors`}
            {note ? ` · ${note}` : ""}
          </p>
        </div>
        <p className="font-mono text-sm text-bone">{formatNumber(value)}</p>
      </div>
      <Bar value={first ? (value > 0 ? 100 : 0) : ofTotal} />
    </div>
  );
}

function OverviewSection({
  range,
  onOpenProfile,
}: {
  range: string;
  onOpenProfile: (target: ProfileTarget) => void;
}) {
  const { data, loading, error } = useAnalyticsData<OverviewData>(
    `/api/admin/user-engagement?${rangeQuery(range)}`
  );

  const s = data?.summary;
  const f = data?.funnel;

  const bagToCheckout = f ? share(f.cartersWhoCheckedOut, f.cartCustomers) : 0;
  const checkoutToOrder = f ? share(f.checkoutsWhoOrdered, f.checkoutCustomers) : 0;
  const bagToOrder = f ? share(f.cartersWhoOrdered, f.cartCustomers) : 0;
  const bagAbandonment = f && f.cartCustomers > 0 ? 100 - bagToOrder : 0;
  const checkoutAbandonment = f && f.checkoutCustomers > 0 ? 100 - checkoutToOrder : 0;

  return (
    <>
      <ErrorNotice message={error} />

      <section className="mt-8">
        <SectionHeading
          eyebrow="OVERVIEW"
          title="Customers"
          description={data?.definitions.visitor}
        />
        <div className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
          <StatCard loading={loading} label="Total users" value={formatNumber(s?.totalUsers ?? 0)} description="Registered customer accounts" />
          <StatCard loading={loading} label="Active users" value={formatNumber(s?.activeUsers ?? 0)} description="Accounts with tracked activity or an order in the period" />
          <StatCard loading={loading} label="New users" value={formatNumber(s?.newUsers ?? 0)} description="First-ever recorded activity is in this period" />
          <StatCard loading={loading} label="Returning users" value={formatNumber(s?.returningUsers ?? 0)} description="Active before this period and again in it" />
          <StatCard loading={loading} label="Visitors" value={formatNumber(s?.visitors ?? 0)} description="Signed-in customers + guest browser sessions" />
          <StatCard loading={loading} label="Sessions" value={formatNumber(s?.sessions ?? 0)} description="Unique browser sessions with activity" />
          <StatCard
            loading={loading}
            label="Orders"
            value={formatNumber(s?.orders ?? 0)}
            description={`Valid orders · ${formatPercent(s?.visitorConversionRate ?? 0)} of visitors ordered`}
          />
          <StatCard loading={loading} label="Revenue" value={formatCurrency(s?.revenue ?? 0)} description="Total of valid orders (incl. shipping)" />
        </div>
      </section>

      <section className="mt-12">
        <SectionHeading
          eyebrow="CUSTOMER BEHAVIOUR"
          title="Store activity"
          description="Raw activity counts (every action, not unique people). Unique-customer rates are in the funnel below."
        />
        <div className="grid grid-cols-2 gap-px bg-line md:grid-cols-3 lg:grid-cols-6">
          <StatCard loading={loading} label="Product views" value={formatNumber(s?.productViews ?? 0)} />
          <StatCard loading={loading} label="Wishlist adds" value={formatNumber(s?.wishlistAdds ?? 0)} />
          <StatCard loading={loading} label="Bag adds" value={formatNumber(s?.cartAdds ?? 0)} />
          <StatCard loading={loading} label="Checkout starts" value={formatNumber(s?.checkoutStarts ?? 0)} />
          <StatCard loading={loading} label="Engaged users" value={formatNumber(s?.engagedUsers ?? 0)} description="Active accounts with a shopping action" />
          <StatCard loading={loading} label="Avg order value" value={formatCurrency(s?.averageOrderValue ?? 0)} />
        </div>
      </section>

      <EngagementTrend data={data?.trend ?? []} loading={loading} />

      <section className="mt-12 grid grid-cols-1 gap-8 xl:grid-cols-2">
        <Panel>
          <PanelHeader
            eyebrow="CONVERSION FUNNEL"
            title="Customer journey by unique visitors"
            description="Each visitor is counted once per stage. Every stage is a share of active visitors, so it can never exceed 100%. Wishlist is optional — customers can go straight to the bag."
          />
          <div className="px-6 sm:px-8">
            {loading || !f ? (
              <p className="py-10 text-center text-sm text-stone">Loading funnel…</p>
            ) : (
              <>
                <FunnelStage first label="Active visitors" value={f.activeVisitors} total={f.activeVisitors} />
                <FunnelStage label="Viewed a product" value={f.productViewers} total={f.activeVisitors} />
                <FunnelStage
                  label="Added to wishlist"
                  value={f.wishlistCustomers}
                  total={f.activeVisitors}
                  note={`${formatPercent(share(f.viewersWhoWishlisted, f.productViewers))} of product viewers`}
                />
                <FunnelStage
                  label="Added to bag"
                  value={f.cartCustomers}
                  total={f.activeVisitors}
                  note={`${formatPercent(share(f.viewersWhoCarted, f.productViewers))} of product viewers`}
                />
                <FunnelStage
                  label="Started checkout"
                  value={f.checkoutCustomers}
                  total={f.activeVisitors}
                  note={`${formatPercent(bagToCheckout)} of bag customers`}
                />
                <FunnelStage
                  label="Placed an order"
                  value={f.purchasingCustomers}
                  total={f.activeVisitors}
                  note={`${formatPercent(checkoutToOrder)} of checkout starters`}
                />
              </>
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            eyebrow="BAG & CHECKOUT"
            title="Where customers drop off"
            description="Unique customers who added to the bag or started checkout in the period, and how many of them placed a valid order."
          />
          <div className="grid grid-cols-2 gap-px bg-line">
            <StatCard loading={loading} label="Bag customers" value={formatNumber(f?.cartCustomers ?? 0)} />
            <StatCard loading={loading} label="Checkout customers" value={formatNumber(f?.checkoutCustomers ?? 0)} />
            <StatCard loading={loading} label="Bag → checkout" value={formatPercent(bagToCheckout)} description="Bag customers who started checkout" />
            <StatCard loading={loading} label="Checkout → order" value={formatPercent(checkoutToOrder)} description="Checkout starters who ordered" />
            <StatCard loading={loading} label="Bag abandonment" value={formatPercent(bagAbandonment)} description="Bag customers with no order in the period" />
            <StatCard loading={loading} label="Checkout abandonment" value={formatPercent(checkoutAbandonment)} description="Checkout starters with no order in the period" />
          </div>
        </Panel>
      </section>

      <section className="mt-12">
        <Panel>
          <PanelHeader
            eyebrow="CUSTOMER ACTIVITY"
            title="Most recently active customers"
            description="Period columns use the selected range; lifetime value uses every valid order."
            action={
              <a href="/admin/user-engagement/customer-profiles" className="label-technical text-mango transition-colors hover:text-bone">
                ALL CUSTOMERS →
              </a>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr className="border-b border-line">
                  <Th>CUSTOMER</Th>
                  <Th>LAST ACTIVE</Th>
                  <Th>SESSIONS</Th>
                  <Th>VIEWS</Th>
                  <Th>ORDERS (PERIOD)</Th>
                  <Th>REVENUE (PERIOD)</Th>
                  <Th align="right">LIFETIME VALUE</Th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <EmptyRow colSpan={7}>Loading customer activity…</EmptyRow>
                ) : !data || data.activity.length === 0 ? (
                  <EmptyRow colSpan={7}>No customer activity in this period.</EmptyRow>
                ) : (
                  data.activity.map((customer) => (
                    <tr key={customer.key} {...rowProps(() => onOpenProfile(targetOf(customer)))}>
                      <td className="max-w-[260px] px-6 py-4"><CustomerCell customer={customer} /></td>
                      <td className="px-4 py-4 text-xs text-stone">{formatDateTime(customer.period.lastActiveAt)}</td>
                      <td className="px-4 py-4 font-mono text-xs text-bone">{formatNumber(customer.period.sessions)}</td>
                      <td className="px-4 py-4 font-mono text-xs text-bone">{formatNumber(customer.period.productViews)}</td>
                      <td className="px-4 py-4 font-mono text-xs text-bone">{formatNumber(customer.period.orders)}</td>
                      <td className="px-4 py-4 font-mono text-xs text-bone">{formatCurrency(customer.period.revenue)}</td>
                      <td className="px-6 py-4 text-right font-mono text-xs text-mango">{formatCurrency(customer.lifetime.revenue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>
    </>
  );
}

const TREND_METRICS: { key: keyof Omit<TrendPoint, "date">; label: string; money?: boolean }[] = [
  { key: "activeUsers", label: "Active Users" },
  { key: "visitors", label: "Visitors" },
  { key: "productViews", label: "Product Views" },
  { key: "wishlistAdds", label: "Wishlist" },
  { key: "cartAdds", label: "Bag Adds" },
  { key: "checkoutStarts", label: "Checkout" },
  { key: "orders", label: "Orders" },
  { key: "revenue", label: "Revenue", money: true },
];

function EngagementTrend({ data, loading }: { data: TrendPoint[]; loading: boolean }) {
  const [metric, setMetric] = useState<(typeof TREND_METRICS)[number]["key"]>("activeUsers");
  const option = TREND_METRICS.find((item) => item.key === metric)!;

  const width = 1000;
  const height = 320;
  const paddingX = 30;
  const paddingY = 30;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  const values = data.map((item) => Number(item[metric]) || 0);
  const maxValue = Math.max(...values, 1);
  const total = values.reduce((sum, value) => sum + value, 0);

  const points = data.map((item, index) => {
    const value = Number(item[metric]) || 0;
    return {
      x: data.length <= 1 ? width / 2 : paddingX + (index / (data.length - 1)) * chartWidth,
      y: paddingY + chartHeight - (value / maxValue) * chartHeight,
      value,
      date: item.date,
    };
  });

  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const format = (value: number) => (option.money ? formatCurrency(value) : formatNumber(value));

  return (
    <section className="mt-12 border border-line bg-charcoal p-6 sm:p-8">
      <div className="flex flex-col gap-5 border-b border-line pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="label-technical text-stone">ENGAGEMENT TREND</p>
          <h2 className="mt-2 font-display text-2xl text-bone">Customer activity over time</h2>
          <p className="mt-2 text-xs text-stone">
            Daily values (India time).{" "}
            {metric === "orders" || metric === "revenue" ? "From valid orders." : "From tracked activity."}{" "}
            {metric === "activeUsers" || metric === "visitors" ? "" : `Period total: ${format(total)}.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {TREND_METRICS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setMetric(item.key)}
              aria-pressed={metric === item.key}
              className={
                metric === item.key
                  ? "border border-bone bg-bone px-3 py-2 text-[10px] font-medium tracking-[0.12em] text-void"
                  : "border border-line-strong px-3 py-2 text-[10px] font-medium tracking-[0.12em] text-stone hover:border-stone hover:text-bone"
              }
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex h-[320px] items-center justify-center">
          <p className="text-sm text-stone">Loading trend…</p>
        </div>
      ) : data.length === 0 ? (
        <div className="flex h-[320px] items-center justify-center">
          <p className="text-sm text-stone">No engagement data available for this period.</p>
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <div className="min-w-[700px]">
            <div className="mb-2 flex justify-between font-mono text-[10px] text-stone-dark">
              <span>Peak: {format(maxValue === 1 && values.every((value) => value === 0) ? 0 : maxValue)}</span>
              <span>{option.label}</span>
            </div>
            <svg viewBox={`0 0 ${width} ${height}`} className="h-[320px] w-full" role="img" aria-label={`${option.label} per day`}>
              {[0, 25, 50, 75, 100].map((percentage) => {
                const y = paddingY + chartHeight - (percentage / 100) * chartHeight;
                return <line key={percentage} x1={paddingX} x2={width - paddingX} y1={y} y2={y} stroke="currentColor" className="text-line" strokeWidth="1" />;
              })}
              {path && (
                <path d={path} fill="none" stroke="currentColor" className="text-mango" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              )}
              {points.map((point) => (
                <circle key={point.date} cx={point.x} cy={point.y} r="4" fill="currentColor" className="text-mango">
                  <title>{`${formatDayKey(point.date)}: ${format(point.value)}`}</title>
                </circle>
              ))}
            </svg>
            <div className="mt-3 flex justify-between px-3">
              {(data.length <= 7
                ? data
                : [data[0], data[Math.floor(data.length / 2)], data[data.length - 1]]
              ).map((item) => (
                <span key={item.date} className="font-mono text-[9px] text-stone-dark">
                  {formatDayKey(item.date)}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ==========================================================================
 * Customer Profiles (server-side search, filters, sorting, paging)
 * ========================================================================== */

const SORT_OPTIONS = [
  { value: "lastActive", label: "Last active" },
  { value: "lifetimeValue", label: "Lifetime value" },
  { value: "orders", label: "Lifetime orders" },
  { value: "score", label: "Engagement score" },
  { value: "joined", label: "Joined / first order" },
  { value: "name", label: "Name" },
];

function ProfilesSection({
  range,
  onOpenProfile,
}: {
  range: string;
  onOpenProfile: (target: ProfileTarget) => void;
}) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [activity, setActivity] = useState("all");
  const [buyers, setBuyers] = useState("all");
  const [segment, setSegment] = useState("");
  const [sort, setSort] = useState("lastActive");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [limit, setLimit] = useState(25);
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebouncedValue(search.trim(), 350);

  const url = useMemo(() => {
    const params = new URLSearchParams({
      range,
      search: debouncedSearch,
      type,
      activity,
      buyers,
      segment,
      sort,
      dir,
      limit: String(limit),
      page: String(page),
    });
    return `/api/admin/user-engagement/customer?${params.toString()}`;
  }, [range, debouncedSearch, type, activity, buyers, segment, sort, dir, limit, page]);

  const { data, lastData, loading, error } = useAnalyticsData<CustomerListData>(url);
  const shown = data ?? lastData;

  // Any filter change starts again from page 1.
  const update = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  return (
    <>
      <ErrorNotice message={error} />

      <section className="mt-8">
        <Panel>
          <PanelHeader
            eyebrow="CUSTOMER DIRECTORY"
            title="All customers"
            description={`Search runs in the database across every account (email, name, mobile, user ID) and guest buyer (order email, name, mobile). Period columns use ${shown?.period.label.toLowerCase() ?? "the selected range"}; orders and value are lifetime.`}
            action={
              <span className="label-technical whitespace-nowrap text-stone">
                {shown ? `${formatNumber(shown.total)} CUSTOMERS` : "—"}
              </span>
            }
          />

          <div className="grid gap-4 border-b border-line p-6 sm:grid-cols-2 sm:p-8 lg:grid-cols-4">
            <label className="block sm:col-span-2">
              <span className="label-technical text-stone">SEARCH</span>
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Email, name, mobile or user ID"
                aria-label="Search customers"
                className="mt-2 w-full border border-line bg-void px-3 py-2 text-sm text-bone outline-none placeholder:text-stone focus:border-mango"
              />
            </label>
            <SelectField
              label="CUSTOMER TYPE"
              value={type}
              onChange={update(setType)}
              options={[
                { value: "all", label: "Accounts + guests" },
                { value: "registered", label: "Accounts only" },
                { value: "guest", label: "Guest buyers only" },
              ]}
            />
            <SelectField
              label="ACTIVITY IN PERIOD"
              value={activity}
              onChange={update(setActivity)}
              options={[
                { value: "all", label: "Everyone" },
                { value: "active", label: "Active in period" },
                { value: "inactive", label: "Not active in period" },
              ]}
            />
            <SelectField
              label="ORDERS"
              value={buyers}
              onChange={update(setBuyers)}
              options={[
                { value: "all", label: "Everyone" },
                { value: "buyers", label: "Has ordered" },
                { value: "non-buyers", label: "Never ordered" },
              ]}
            />
            <SelectField
              label="SEGMENT"
              value={segment}
              onChange={update(setSegment)}
              options={[
                { value: "", label: "Any segment" },
                ...(shown?.segmentDefinitions ?? []).map((item) => ({ value: item.key, label: item.label })),
              ]}
            />
            <SelectField label="SORT BY" value={sort} onChange={update(setSort)} options={SORT_OPTIONS} />
            <SelectField
              label="ORDER"
              value={dir}
              onChange={update((value: string) => setDir(value === "asc" ? "asc" : "desc"))}
              options={[
                { value: "desc", label: "High → low / newest" },
                { value: "asc", label: "Low → high / oldest" },
              ]}
            />
            <SelectField
              label="PER PAGE"
              value={String(limit)}
              onChange={update((value: string) => setLimit(Number(value)))}
              options={[25, 50, 100].map((value) => ({ value: String(value), label: String(value) }))}
            />
          </div>

          <div className={`overflow-x-auto transition-opacity ${loading && shown ? "opacity-60" : ""}`}>
            <table className="w-full min-w-[860px]">
              <thead>
                <tr className="border-b border-line">
                  <Th>CUSTOMER</Th>
                  <Th>LAST ACTIVE · JOINED</Th>
                  <Th>PERIOD ACTIVITY</Th>
                  <Th>SCORE · SEGMENT</Th>
                  <Th>ORDERS</Th>
                  <Th align="right">LIFETIME VALUE</Th>
                </tr>
              </thead>
              <tbody>
                {!shown ? (
                  <EmptyRow colSpan={6}>Loading customers…</EmptyRow>
                ) : shown.customers.length === 0 ? (
                  <EmptyRow colSpan={6}>
                    {debouncedSearch ? `No customers match “${debouncedSearch}”.` : "No customers match these filters."}
                  </EmptyRow>
                ) : (
                  shown.customers.map((customer) => (
                    <tr key={customer.key} {...rowProps(() => onOpenProfile(targetOf(customer)))}>
                      <td className="max-w-[260px] px-6 py-4"><CustomerCell customer={customer} /></td>
                      <td className="px-4 py-4">
                        <p className="text-xs text-bone">{formatDate(customer.lastActiveAt)}</p>
                        <p className="mt-1 text-[10px] text-stone">
                          {customer.isGuest ? "First order" : "Joined"} {formatDate(customer.joinedAt)}
                        </p>
                      </td>
                      <td className="px-4 py-4 font-mono text-[10px] leading-relaxed text-stone">
                        {countOf(customer.period.sessions, "session")} · {countOf(customer.period.productViews, "view")}
                        <br />
                        {formatNumber(customer.period.cartAdds)} bag · {countOf(customer.period.orders, "order")}
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-mono text-xs text-mango">{customer.engagementScore}/100</p>
                        <p className="mt-1 text-[11px] text-bone">{customer.segment.label}</p>
                      </td>
                      <td className="px-4 py-4 font-mono text-xs text-bone">{formatNumber(customer.lifetime.orders)}</td>
                      <td className="px-6 py-4 text-right font-mono text-xs text-mango">{formatCurrency(customer.lifetime.revenue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {shown && (
            <Pagination
              page={shown.page}
              totalPages={shown.totalPages}
              total={shown.total}
              limit={shown.limit}
              onPage={setPage}
              loading={loading}
              noun="customers"
            />
          )}
        </Panel>
      </section>
    </>
  );
}

/* ==========================================================================
 * Customer Segments
 * ========================================================================== */

const EMPTY_CRITERIA: SegmentCriteria = {
  minViews: 0,
  minWishlist: 0,
  minCart: 0,
  minOrders: 0,
  minRevenue: 0,
  inactiveDays: 0,
  segment: "",
};

const SEGMENT_PRESETS: { key: string; label: string; criteria: SegmentCriteria }[] = [
  { key: "cart-abandoners", label: "Cart abandoners", criteria: { ...EMPTY_CRITERIA, segment: "cart-abandoners" } },
  { key: "product-viewers", label: "Viewed 3+ products", criteria: { ...EMPTY_CRITERIA, minViews: 3 } },
  { key: "high-value", label: "High value (₹10k+ lifetime)", criteria: { ...EMPTY_CRITERIA, segment: "high-value" } },
  { key: "loyal", label: "Loyal (2+ orders)", criteria: { ...EMPTY_CRITERIA, segment: "loyal" } },
  { key: "wishlist-heavy", label: "Wishlist heavy", criteria: { ...EMPTY_CRITERIA, segment: "wishlist-heavy" } },
  { key: "inactive-30d", label: "Inactive 30+ days", criteria: { ...EMPTY_CRITERIA, inactiveDays: 30 } },
];

const NUMBER_FIELDS: { key: Exclude<keyof SegmentCriteria, "segment">; label: string; group: "period" | "lifetime" | "inactive" }[] = [
  { key: "minViews", label: "Product views ≥", group: "period" },
  { key: "minWishlist", label: "Wishlist adds ≥", group: "period" },
  { key: "minCart", label: "Bag adds ≥", group: "period" },
  { key: "minOrders", label: "Orders ≥", group: "lifetime" },
  { key: "minRevenue", label: "Revenue ≥ ₹", group: "lifetime" },
  { key: "inactiveDays", label: "Inactive for ≥ days", group: "inactive" },
];

function sameCriteria(a: SegmentCriteria, b: SegmentCriteria) {
  return (Object.keys(EMPTY_CRITERIA) as (keyof SegmentCriteria)[]).every((key) => a[key] === b[key]);
}

function describeCriteria(criteria: SegmentCriteria, definitions: SegmentDefinition[]) {
  const parts: string[] = [];
  if (criteria.segment) {
    parts.push(definitions.find((item) => item.key === criteria.segment)?.label ?? criteria.segment);
  }
  if (criteria.minViews) parts.push(`views ≥ ${criteria.minViews}`);
  if (criteria.minWishlist) parts.push(`wishlist ≥ ${criteria.minWishlist}`);
  if (criteria.minCart) parts.push(`bag ≥ ${criteria.minCart}`);
  if (criteria.minOrders) parts.push(`lifetime orders ≥ ${criteria.minOrders}`);
  if (criteria.minRevenue) parts.push(`lifetime revenue ≥ ${formatCurrency(criteria.minRevenue)}`);
  if (criteria.inactiveDays) parts.push(`inactive ≥ ${criteria.inactiveDays} days`);
  return parts.length ? parts.join(" · ") : "All customers";
}

function SegmentsSection({
  range,
  onOpenProfile,
}: {
  range: string;
  onOpenProfile: (target: ProfileTarget) => void;
}) {
  const [criteria, setCriteria] = useState<SegmentCriteria>(SEGMENT_PRESETS[0].criteria);
  const [page, setPage] = useState(1);
  const [refreshToken, setRefreshToken] = useState(0);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const debouncedCriteria = useDebouncedValue(criteria, 350);
  const criteriaJson = JSON.stringify(debouncedCriteria);

  const url = `/api/admin/user-engagement/segments?${new URLSearchParams({
    range,
    criteria: criteriaJson,
    page: String(page),
    limit: "50",
  }).toString()}`;

  const { data, lastData, loading, error } = useAnalyticsData<SegmentsData>(url, refreshToken);
  const shown = data ?? lastData;
  const definitions = shown?.segmentDefinitions ?? [];

  const changeCriteria = (next: SegmentCriteria) => {
    setCriteria(next);
    setPage(1);
  };

  async function mutate(request: () => Promise<Response>, success: string) {
    setBusy(true);
    setActionMessage(null);
    try {
      const response = await request();
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "Something went wrong.");
      setActionMessage(success);
      setRefreshToken((value) => value + 1);
      return true;
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Something went wrong.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveSegment(event: FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) {
      setActionMessage("Give the segment a name first.");
      return;
    }
    const ok = await mutate(
      () =>
        fetch("/api/admin/user-engagement/segments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, criteria }),
        }),
      `Saved “${name}”.`
    );
    if (ok) setNewName("");
  }

  async function renameSegment(id: string) {
    const name = renameValue.trim();
    if (!name) return;
    const ok = await mutate(
      () =>
        fetch("/api/admin/user-engagement/segments", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, name }),
        }),
      `Renamed to “${name}”.`
    );
    if (ok) setRenamingId(null);
  }

  async function updateSegmentCriteria(segment: SavedSegment) {
    await mutate(
      () =>
        fetch("/api/admin/user-engagement/segments", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: segment.id, criteria }),
        }),
      `Updated “${segment.name}” with the current filters.`
    );
  }

  async function deleteSegment(segment: SavedSegment) {
    const ok = await mutate(
      () => fetch(`/api/admin/user-engagement/segments?id=${encodeURIComponent(segment.id)}`, { method: "DELETE" }),
      `Deleted “${segment.name}”.`
    );
    if (ok) setConfirmDeleteId(null);
  }

  function exportCsv() {
    const params = new URLSearchParams({ range, criteria: JSON.stringify(criteria), export: "csv" });
    window.open(`/api/admin/user-engagement/segments?${params.toString()}`, "_blank", "noopener");
  }

  const summary = shown?.summary;
  const activePreset = SEGMENT_PRESETS.find((preset) => sameCriteria(preset.criteria, criteria))?.key;

  return (
    <>
      <ErrorNotice message={error} />

      <section className="mt-8">
        <SectionHeading
          eyebrow="CUSTOMER SEGMENTS & ENGAGEMENT SCORE"
          title="Where customers sit in the journey"
          description={`Behaviour and score use ${shown?.period.label.toLowerCase() ?? "the selected period"}; High Value and Loyal use lifetime orders. Customers can belong to more than one segment. ${shown?.definitions.engagementScore ?? ""}`}
        />
        <div className="grid grid-cols-2 gap-px bg-line md:grid-cols-5">
          <StatCard loading={!summary} label="Active customers" value={formatNumber(summary?.activeCustomers ?? 0)} description="Activity or an order in the period" />
          <StatCard loading={!summary} label="Average score" value={`${summary?.averageScore ?? 0}/100`} description="Across active customers" />
          <StatCard loading={!summary} label="Highly engaged" value={formatNumber(summary?.highlyEngaged ?? 0)} description="Score 40+ in the period" />
          <StatCard loading={!summary} label="High value" value={formatNumber(summary?.highValue ?? 0)} description="₹10,000+ lifetime revenue" />
          <div className="col-span-2 md:col-span-1">
            <StatCard loading={!summary} label="Cart abandoners" value={formatNumber(summary?.cartAbandoners ?? 0)} description="No order since latest bag add" />
          </div>
        </div>

        <div className="mt-8 space-y-8">
          <Panel>
            <PanelHeader
              eyebrow="BEHAVIOURAL SEGMENTS"
              title="Segment sizes"
              description="Share of customers active in the period. Click a segment to list its customers below."
            />
            <div className="grid gap-x-10 px-6 pb-2 sm:grid-cols-2 sm:px-8 xl:grid-cols-3">
              {!summary ? (
                <p className="py-6 text-center text-sm text-stone">Loading segments…</p>
              ) : (
                summary.segments.map((segment) => (
                  <button
                    key={segment.key}
                    type="button"
                    onClick={() => changeCriteria({ ...EMPTY_CRITERIA, segment: segment.key })}
                    className="block w-full border-b border-line py-5 text-left hover:opacity-90"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="flex items-center gap-2 text-sm text-bone">
                          {segment.label} <ScopeTag scope={segment.scope} />
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-stone">{segment.description}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-mono text-sm text-bone">{formatNumber(segment.customers)}</p>
                        <p className="mt-1 font-mono text-[10px] text-mango">{formatPercent(segment.share)}</p>
                      </div>
                    </div>
                    <Bar value={segment.share} />
                  </button>
                ))
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              eyebrow="ENGAGEMENT SCORE"
              title="Most engaged customers"
              description="Top 10 by engagement score in the selected period."
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="border-b border-line">
                    <Th>CUSTOMER</Th>
                    <Th>SCORE</Th>
                    <Th>PERIOD ACTIVITY</Th>
                    <Th>SEGMENT</Th>
                    <Th align="right">LIFETIME VALUE</Th>
                  </tr>
                </thead>
                <tbody>
                  {!summary ? (
                    <EmptyRow colSpan={5}>Loading…</EmptyRow>
                  ) : summary.mostEngaged.length === 0 ? (
                    <EmptyRow colSpan={5}>No customer activity in this period.</EmptyRow>
                  ) : (
                    summary.mostEngaged.map((customer) => (
                      <tr key={customer.key} {...rowProps(() => onOpenProfile(targetOf(customer)))}>
                        <td className="max-w-[220px] px-6 py-4"><CustomerCell customer={customer} /></td>
                        <td className="px-4 py-4">
                          <p className="font-mono text-xs text-mango">{customer.engagementScore}</p>
                          <div className="mt-2 h-1 w-20 bg-void">
                            <div className="h-full bg-mango" style={{ width: `${customer.engagementScore}%` }} />
                          </div>
                        </td>
                        <td className="px-4 py-4 font-mono text-[10px] text-stone">
                          {countOf(customer.period.productViews, "view")} · {formatNumber(customer.period.cartAdds)} bag · {countOf(customer.period.orders, "order")}
                        </td>
                        <td className="px-4 py-4 text-xs text-bone">{customer.segment.label}</td>
                        <td className="px-6 py-4 text-right font-mono text-xs text-mango">{formatCurrency(customer.lifetime.revenue)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </section>

      <section className="mt-12">
        <SectionHeading
          eyebrow="SEGMENT BUILDER"
          title="Build actionable customer lists"
          description="Combine selected-period behaviour, lifetime value and inactivity. Save the result to reuse it, or export every matching customer as CSV."
          action={
            <button
              type="button"
              onClick={exportCsv}
              className="border border-mango px-4 py-3 text-[10px] tracking-[0.14em] text-mango transition-colors hover:bg-mango hover:text-void"
            >
              EXPORT CSV
            </button>
          }
        />

        <Panel>
          <div className="grid gap-px bg-line md:grid-cols-3">
            {(["period", "lifetime", "inactive"] as const).map((group) => (
              <div key={group} className="bg-charcoal p-5">
                <p className="mb-3 flex items-center gap-2 label-technical text-stone">
                  {group === "period" ? "SELECTED PERIOD BEHAVIOUR" : group === "lifetime" ? "LIFETIME VALUE" : "INACTIVITY (FROM TODAY)"}
                </p>
                <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-1 xl:grid-cols-3">
                  {NUMBER_FIELDS.filter((field) => field.group === group).map((field) => (
                    <label key={field.key} className="block">
                      <span className="text-[11px] text-stone">{field.label}</span>
                      <input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        value={criteria[field.key] || ""}
                        placeholder="0"
                        onChange={(event) =>
                          changeCriteria({ ...criteria, [field.key]: Math.max(0, Number(event.target.value) || 0) })
                        }
                        className="mt-2 w-full border border-line bg-void px-3 py-2 font-mono text-sm text-bone outline-none focus:border-mango"
                      />
                    </label>
                  ))}
                  {group === "inactive" && (
                    <label className="block sm:col-span-2 md:col-span-1 xl:col-span-2">
                      <span className="text-[11px] text-stone">Segment</span>
                      <select
                        value={criteria.segment}
                        onChange={(event) => changeCriteria({ ...criteria, segment: event.target.value })}
                        className={selectClass}
                      >
                        <option value="">Any segment</option>
                        {definitions.map((definition) => (
                          <option key={definition.key} value={definition.key}>
                            {definition.label} ({definition.scope})
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-line p-5">
            {SEGMENT_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => changeCriteria(preset.criteria)}
                className={`border px-4 py-2 text-[10px] tracking-[0.12em] ${
                  activePreset === preset.key ? "border-mango text-mango" : "border-line-strong text-stone hover:text-bone"
                }`}
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => changeCriteria(EMPTY_CRITERIA)}
              className="border border-line-strong px-4 py-2 text-[10px] tracking-[0.12em] text-stone hover:text-bone"
            >
              CLEAR FILTERS
            </button>
          </div>
        </Panel>

        <div className="mt-8 space-y-8">
          <Panel>
            <PanelHeader
              eyebrow="SAVED SEGMENTS"
              title="Your audiences"
              description="Load a saved segment, update it with the current filters, rename or delete it."
            />
            <form onSubmit={saveSegment} className="flex max-w-2xl gap-2 border-b border-line p-5 sm:border-b-0 sm:px-8">
              <input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                maxLength={80}
                placeholder="Name the current filters…"
                aria-label="New segment name"
                className="min-w-0 flex-1 border border-line bg-void px-3 py-2 text-sm text-bone outline-none placeholder:text-stone focus:border-mango"
              />
              <button
                type="submit"
                disabled={busy}
                className="border border-line-strong px-4 py-2 text-[10px] tracking-[0.14em] text-bone hover:border-bone disabled:opacity-50"
              >
                SAVE
              </button>
            </form>
            {actionMessage && <p className="px-5 pb-3 text-xs text-mango sm:px-8">{actionMessage}</p>}
            <div className="border-t border-line">
              {!shown ? (
                <p className="p-5 text-sm text-stone">Loading…</p>
              ) : shown.savedSegments.length === 0 ? (
                <p className="p-5 text-sm text-stone">No saved segments yet.</p>
              ) : (
                shown.savedSegments.map((segment) => {
                  const isCurrent = sameCriteria(segment.criteria, criteria);
                  return (
                    <div key={segment.id} className={`border-b border-line p-5 last:border-0 sm:px-8 ${isCurrent ? "bg-void/40" : ""}`}>
                      {renamingId === segment.id ? (
                        <form
                          className="flex gap-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void renameSegment(segment.id);
                          }}
                        >
                          <input
                            value={renameValue}
                            onChange={(event) => setRenameValue(event.target.value)}
                            maxLength={80}
                            autoFocus
                            aria-label="Segment name"
                            className="min-w-0 flex-1 border border-line bg-void px-3 py-2 text-sm text-bone outline-none focus:border-mango"
                          />
                          <button type="submit" disabled={busy} className="border border-mango px-3 py-2 text-[10px] tracking-[0.12em] text-mango disabled:opacity-50">
                            SAVE
                          </button>
                          <button type="button" onClick={() => setRenamingId(null)} className="border border-line-strong px-3 py-2 text-[10px] tracking-[0.12em] text-stone">
                            CANCEL
                          </button>
                        </form>
                      ) : (
                        <div className="md:flex md:items-center md:justify-between md:gap-6">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm text-bone">{segment.name}</p>
                              <p className="mt-1 text-[11px] leading-relaxed text-stone">{describeCriteria(segment.criteria, definitions)}</p>
                              <p className="mt-1 font-mono text-[10px] text-stone-dark">Saved {formatDate(segment.updatedAt ?? segment.createdAt)}</p>
                            </div>
                            {isCurrent && <span className="shrink-0 font-mono text-[9px] tracking-[0.12em] text-mango">LOADED</span>}
                          </div>
                          {confirmDeleteId === segment.id ? (
                            <div className="mt-3 flex shrink-0 flex-wrap items-center gap-2 md:mt-0">
                              <span className="text-xs text-stone">Delete this segment?</span>
                              <button type="button" disabled={busy} onClick={() => void deleteSegment(segment)} className="border border-mango px-3 py-1.5 text-[10px] tracking-[0.12em] text-mango disabled:opacity-50">
                                DELETE
                              </button>
                              <button type="button" onClick={() => setConfirmDeleteId(null)} className="border border-line-strong px-3 py-1.5 text-[10px] tracking-[0.12em] text-stone">
                                KEEP
                              </button>
                            </div>
                          ) : (
                            <div className="mt-3 flex shrink-0 flex-wrap gap-2 md:mt-0">
                              <button type="button" onClick={() => changeCriteria(segment.criteria)} className="border border-line-strong px-3 py-1.5 text-[10px] tracking-[0.12em] text-bone hover:border-bone">
                                LOAD
                              </button>
                              <button
                                type="button"
                                disabled={busy || isCurrent}
                                onClick={() => void updateSegmentCriteria(segment)}
                                className="border border-line-strong px-3 py-1.5 text-[10px] tracking-[0.12em] text-stone hover:text-bone disabled:opacity-40"
                              >
                                UPDATE FILTERS
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRenamingId(segment.id);
                                  setRenameValue(segment.name);
                                }}
                                className="border border-line-strong px-3 py-1.5 text-[10px] tracking-[0.12em] text-stone hover:text-bone"
                              >
                                RENAME
                              </button>
                              <button type="button" onClick={() => setConfirmDeleteId(segment.id)} className="border border-line-strong px-3 py-1.5 text-[10px] tracking-[0.12em] text-stone hover:text-mango">
                                DELETE
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              eyebrow="MATCHING CUSTOMERS"
              title={describeCriteria(criteria, definitions)}
              action={
                <span className="label-technical whitespace-nowrap text-stone">
                  {shown ? `${formatNumber(shown.total)} CUSTOMERS` : "—"}
                </span>
              }
            />
            <div className={`overflow-x-auto transition-opacity ${loading && shown ? "opacity-60" : ""}`}>
              <table className="w-full min-w-[960px]">
                <thead>
                  <tr className="border-b border-line">
                    <Th>CUSTOMER</Th>
                    <Th>PERIOD BEHAVIOUR</Th>
                    <Th>SCORE</Th>
                    <Th>SEGMENT</Th>
                    <Th>LIFETIME ORDERS</Th>
                    <Th>LIFETIME VALUE</Th>
                    <Th align="right">LAST ACTIVE</Th>
                  </tr>
                </thead>
                <tbody>
                  {!shown ? (
                    <EmptyRow colSpan={7}>Loading segment…</EmptyRow>
                  ) : shown.customers.length === 0 ? (
                    <EmptyRow colSpan={7}>No customers match this segment.</EmptyRow>
                  ) : (
                    shown.customers.map((customer) => (
                      <tr key={customer.key} {...rowProps(() => onOpenProfile(targetOf(customer)))}>
                        <td className="max-w-[240px] px-6 py-4"><CustomerCell customer={customer} /></td>
                        <td className="px-4 py-4 font-mono text-[10px] text-stone">
                          {countOf(customer.period.productViews, "view")} · {formatNumber(customer.period.wishlistAdds)} wishlist · {formatNumber(customer.period.cartAdds)} bag · {countOf(customer.period.sessions, "session")}
                        </td>
                        <td className="px-4 py-4 font-mono text-xs text-mango">{customer.engagementScore}</td>
                        <td className="px-4 py-4 text-xs text-bone">{customer.segment.label}</td>
                        <td className="px-4 py-4 font-mono text-xs text-bone">{formatNumber(customer.lifetime.orders)}</td>
                        <td className="px-4 py-4 font-mono text-xs text-mango">{formatCurrency(customer.lifetime.revenue)}</td>
                        <td className="px-6 py-4 text-right font-mono text-[10px] text-stone">{formatDate(customer.lastActiveAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {shown && (
              <Pagination
                page={shown.page}
                totalPages={shown.totalPages}
                total={shown.total}
                limit={shown.limit}
                onPage={setPage}
                loading={loading}
                noun="customers"
              />
            )}
          </Panel>
        </div>
      </section>
    </>
  );
}

/* ==========================================================================
 * Feature Usage
 * ========================================================================== */

function FeatureUsageSection({ range }: { range: string }) {
  const { data, loading, error } = useAnalyticsData<FeatureUsageData>(
    `/api/admin/user-engagement/feature-usage?${rangeQuery(range)}`
  );
  const features = data?.features ?? [];
  const olderWithoutSession = features.reduce((sum, feature) => sum + feature.usesWithoutSession, 0);

  return (
    <>
      <ErrorNotice message={error} />
      <section className="mt-8">
        <SectionHeading
          eyebrow="FEATURE USAGE ANALYTICS"
          title="Which Mangosta features are actually being used?"
          description="Uses = every recorded action. Customers = unique signed-in customers. Sessions = unique browser sessions (signed-in or guest)."
        />
        <div className="grid grid-cols-2 gap-px bg-line md:grid-cols-5">
          {(loading ? [] : features).map((feature) => (
            <div key={feature.key} className="bg-charcoal p-5">
              <p className="label-technical text-stone">{feature.label}</p>
              <p className="mt-4 font-display text-3xl text-bone">{formatNumber(feature.uses)}</p>
              <p className="mt-1 text-[10px] text-stone">uses</p>
              <div className="mt-4 flex justify-between border-t border-line pt-3 font-mono text-[10px] text-stone">
                <span>{countOf(feature.uniqueUsers, "customer")}</span>
                <span>{countOf(feature.uniqueSessions, "session")}</span>
              </div>
            </div>
          ))}
        </div>
        {loading && <p className="mt-6 text-sm text-stone">Loading feature usage…</p>}

        <div className="mt-8 overflow-x-auto border border-line bg-charcoal">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-line">
                <Th>FEATURE</Th>
                <Th>WHAT COUNTS AS A USE</Th>
                <Th>USES</Th>
                <Th>CUSTOMERS</Th>
                <Th>SESSIONS</Th>
                <Th align="right">BREAKDOWN</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <EmptyRow colSpan={6}>Loading…</EmptyRow>
              ) : (
                features.map((feature) => (
                  <tr key={feature.key} className="border-b border-line last:border-0">
                    <td className="px-6 py-4 text-sm text-bone">{feature.label}</td>
                    <td className="max-w-[320px] px-4 py-4 text-xs leading-relaxed text-stone">{feature.description}</td>
                    <td className="px-4 py-4 font-mono text-xs text-mango">{formatNumber(feature.uses)}</td>
                    <td className="px-4 py-4 font-mono text-xs text-stone">{formatNumber(feature.uniqueUsers)}</td>
                    <td className="px-4 py-4 font-mono text-xs text-stone">{formatNumber(feature.uniqueSessions)}</td>
                    <td className="px-6 py-4 text-right font-mono text-[10px] text-stone">
                      {feature.breakdown.map((item) => `${item.label}: ${formatNumber(item.count)}`).join(" · ")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {olderWithoutSession > 0 && (
          <p className="mt-3 text-xs text-stone">
            {formatNumber(olderWithoutSession)} older uses in this period were recorded before server events carried a session id, so they count toward uses and customers but not sessions.
          </p>
        )}
      </section>
    </>
  );
}

/* ==========================================================================
 * Retention
 * ========================================================================== */

function RetentionSection({ range }: { range: string }) {
  const { data, loading, error } = useAnalyticsData<RetentionData>(
    `/api/admin/user-engagement/retention?${rangeQuery(range)}`
  );
  const s = data?.summary;

  return (
    <>
      <ErrorNotice message={error} />
      <section className="mt-8">
        <SectionHeading
          eyebrow="CUSTOMER RETENTION"
          title="First-activity cohorts"
          description={data?.definitions.cohort}
        />
        <div className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
          <StatCard loading={loading} label="New customers" value={formatNumber(s?.totalCustomers ?? 0)} description="First-ever activity in the selected period" />
          <StatCard loading={loading} label="Returned" value={formatNumber(s?.returnedCustomers ?? 0)} description={`${formatPercent(s?.returnRate ?? 0)} came back on a later day`} />
          <StatCard loading={loading} label="Not yet returned" value={formatNumber(s?.notReturnedCustomers ?? 0)} description="Only active on their first day so far" />
          <StatCard loading={loading} label="Repeat buyers" value={formatNumber(s?.repeatBuyers ?? 0)} description={`${formatPercent(s?.repeatBuyerRate ?? 0)} have 2+ lifetime orders`} />
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <Panel>
            <PanelHeader eyebrow="RETENTION OVER TIME" title="Returned within N days" description={data?.definitions.dayN} />
            <div className="space-y-6 p-6 sm:p-8">
              {loading ? (
                <p className="py-6 text-center text-sm text-stone">Loading…</p>
              ) : (
                (data?.retention ?? []).map((item) => (
                  <div key={item.day}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-bone">Within {item.day} {item.day === 1 ? "day" : "days"}</span>
                      <span className="font-mono text-xs text-mango">{item.eligible > 0 ? formatPercent(item.rate) : "—"}</span>
                    </div>
                    <Bar value={item.rate} />
                    <p className="mt-2 text-xs text-stone">
                      {item.eligible > 0
                        ? `${formatNumber(item.retained)} of ${countOf(item.eligible, "customer")} whose ${item.day}-day window has passed`
                        : `No customers have completed a ${item.day}-day window yet`}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader eyebrow="CUSTOMER MIX" title="Returned vs not yet returned" description={data?.definitions.returned} />
            <div className="space-y-6 p-6 sm:p-8">
              {[
                { label: "Returned", value: s?.returnedCustomers ?? 0 },
                { label: "Not yet returned", value: s?.notReturnedCustomers ?? 0 },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-sm">
                    <span className="text-bone">{item.label}</span>
                    <span className="font-mono text-xs text-stone">{loading ? "—" : formatNumber(item.value)}</span>
                  </div>
                  <Bar value={share(item.value, s?.totalCustomers ?? 0)} />
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="mt-8">
          <Panel>
            <PanelHeader eyebrow="CUSTOMER COHORTS" title="Retention by first-activity day" description="“—” means that cohort's window hasn't fully passed yet." />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px]">
                <thead>
                  <tr className="border-b border-line">
                    <Th>COHORT (FIRST ACTIVITY)</Th>
                    <Th>CUSTOMERS</Th>
                    <Th>WITHIN 7D</Th>
                    <Th>WITHIN 14D</Th>
                    <Th align="right">WITHIN 30D</Th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <EmptyRow colSpan={5}>Loading cohorts…</EmptyRow>
                  ) : !data || data.cohorts.length === 0 ? (
                    <EmptyRow colSpan={5}>No new customers in this period.</EmptyRow>
                  ) : (
                    data.cohorts.map((cohort) => (
                      <tr key={cohort.date} className="border-b border-line last:border-0">
                        <td className="px-6 py-4 text-sm text-bone">{formatDayKey(cohort.date)}</td>
                        <td className="px-4 py-4 font-mono text-xs text-stone">{formatNumber(cohort.customers)}</td>
                        <td className="px-4 py-4 font-mono text-xs text-bone">{cohort.day7 === null ? "—" : formatPercent(cohort.day7)}</td>
                        <td className="px-4 py-4 font-mono text-xs text-bone">{cohort.day14 === null ? "—" : formatPercent(cohort.day14)}</td>
                        <td className="px-6 py-4 text-right font-mono text-xs text-bone">{cohort.day30 === null ? "—" : formatPercent(cohort.day30)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </section>
    </>
  );
}

/* ==========================================================================
 * Customer LTV
 * ========================================================================== */

function ValueGroups({ title, eyebrow, groups, revenueLabel }: { title: string; eyebrow: string; groups: ValueGroup[]; revenueLabel: string }) {
  const maxRevenue = Math.max(1, ...groups.map((group) => group.revenue));

  return (
    <Panel>
      <PanelHeader eyebrow={eyebrow} title={title} />
      <div className="space-y-5 p-6 sm:p-8">
        {groups.length === 0 ? (
          <p className="text-sm text-stone">Loading…</p>
        ) : (
          groups.map((group) => (
            <div key={group.label}>
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-bone">{group.label}</span>
                <span className="font-mono text-xs text-mango">{formatCurrency(group.revenue)}</span>
              </div>
              <Bar value={(group.revenue / maxRevenue) * 100} />
              <p className="mt-2 text-xs text-stone">
                {countOf(group.customers, "customer")} · {formatCurrency(group.averageValue)} average {revenueLabel}
              </p>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

function LtvSection({
  range,
  onOpenProfile,
}: {
  range: string;
  onOpenProfile: (target: ProfileTarget) => void;
}) {
  const { data, loading, error } = useAnalyticsData<LtvData>(
    `/api/admin/user-engagement/ltv?${rangeQuery(range)}`
  );
  const l = data?.lifetime;
  const p = data?.periodSummary;

  return (
    <>
      <ErrorNotice message={error} />
      <section className="mt-8">
        <SectionHeading
          eyebrow="LIFETIME · ALL CUSTOMERS, ALL TIME"
          title="Customer lifetime value"
          description={data?.definitions.lifetime}
        />
        <div className="grid grid-cols-2 gap-px bg-line md:grid-cols-3 lg:grid-cols-6">
          <StatCard loading={loading} label="Paying customers" value={formatNumber(l?.payingCustomers ?? 0)} description={`${countOf(l?.registeredCustomers ?? 0, "account")} · ${countOf(l?.guestCustomers ?? 0, "guest")}`} />
          <StatCard loading={loading} label="Customer LTV" value={formatCurrency(l?.customerLifetimeValue ?? 0)} description="Lifetime revenue ÷ paying customers" />
          <StatCard loading={loading} label="Lifetime revenue" value={formatCurrency(l?.lifetimeRevenue ?? 0)} description={`${countOf(l?.lifetimeOrders ?? 0, "valid order")}`} />
          <StatCard loading={loading} label="Repeat purchase rate" value={formatPercent(l?.repeatPurchaseRate ?? 0)} description={`${countOf(l?.repeatBuyers ?? 0, "customer")} with 2+ orders`} />
          <StatCard loading={loading} label="Orders / customer" value={(l?.averageOrdersPerCustomer ?? 0).toFixed(2)} description={`AOV ${formatCurrency(l?.averageOrderValue ?? 0)}`} />
          <StatCard loading={loading} label="High-value customers" value={formatNumber(l?.highValueCustomers ?? 0)} description="₹10,000+ lifetime revenue" />
        </div>
      </section>

      <section className="mt-12">
        <SectionHeading
          eyebrow={`SELECTED PERIOD · ${(data?.period.label ?? "").toUpperCase()}`}
          title="What happened in this period"
          description={data?.definitions.period}
        />
        <div className="grid grid-cols-2 gap-px bg-line md:grid-cols-3 lg:grid-cols-6">
          <StatCard loading={loading} label="Buyers" value={formatNumber(p?.buyers ?? 0)} description="Customers who ordered" />
          <StatCard loading={loading} label="Orders" value={formatNumber(p?.orders ?? 0)} />
          <StatCard loading={loading} label="Revenue" value={formatCurrency(p?.revenue ?? 0)} />
          <StatCard loading={loading} label="Avg order value" value={formatCurrency(p?.averageOrderValue ?? 0)} />
          <StatCard loading={loading} label="New buyers" value={formatNumber(p?.newBuyers ?? 0)} description="First-ever order in the period" />
          <StatCard loading={loading} label="Returning buyers" value={formatNumber(p?.returningBuyers ?? 0)} description="Had ordered before the period" />
        </div>
      </section>

      <section className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <ValueGroups eyebrow="PURCHASE FREQUENCY · LIFETIME" title="Customers by order count" groups={loading ? [] : data?.purchaseFrequency ?? []} revenueLabel="lifetime value" />
        <ValueGroups eyebrow="CUSTOMER TYPES · LIFETIME" title="Who generates the value?" groups={loading ? [] : data?.customerTypes ?? []} revenueLabel="lifetime value" />
        <ValueGroups eyebrow="BUYERS · SELECTED PERIOD" title="New vs returning buyers" groups={loading ? [] : data?.periodBuyerTypes ?? []} revenueLabel="spend in period" />
      </section>

      <section className="mt-8">
        <Panel>
          <PanelHeader
            eyebrow="TOP CUSTOMER VALUE · LIFETIME"
            title="Highest lifetime-value customers"
            description="Ranked by lifetime revenue across every customer who has ever ordered. Click a customer to open their profile."
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px]">
              <thead>
                <tr className="border-b border-line">
                  <Th>CUSTOMER</Th>
                  <Th>ORDERS</Th>
                  <Th>AVG ORDER</Th>
                  <Th>FIRST ORDER</Th>
                  <Th>LAST ORDER</Th>
                  <Th align="right">LIFETIME VALUE</Th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <EmptyRow colSpan={6}>Loading…</EmptyRow>
                ) : !data || data.topCustomers.length === 0 ? (
                  <EmptyRow colSpan={6}>No orders yet.</EmptyRow>
                ) : (
                  data.topCustomers.map((customer) => (
                    <tr key={customer.key} {...rowProps(() => onOpenProfile(targetOf(customer)))}>
                      <td className="max-w-[280px] px-6 py-4"><CustomerCell customer={{ ...customer, mobile: "" }} /></td>
                      <td className="px-4 py-4 font-mono text-xs text-bone">{formatNumber(customer.orders)}</td>
                      <td className="px-4 py-4 font-mono text-xs text-bone">{formatCurrency(customer.averageOrderValue)}</td>
                      <td className="px-4 py-4 text-xs text-stone">{formatDate(customer.firstPurchaseAt)}</td>
                      <td className="px-4 py-4 text-xs text-stone">{formatDate(customer.lastPurchaseAt)}</td>
                      <td className="px-6 py-4 text-right font-mono text-xs text-mango">{formatCurrency(customer.revenue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>
    </>
  );
}

/* ==========================================================================
 * Search Analytics
 * ========================================================================== */

function SearchSection({ range }: { range: string }) {
  const { data, loading, error } = useAnalyticsData<SearchData>(
    `/api/admin/user-engagement/search?${rangeQuery(range)}`
  );
  const s = data?.summary;
  const maxSearches = Math.max(1, ...(data?.trend ?? []).map((point) => point.searches));

  return (
    <>
      <ErrorNotice message={error} />
      <section className="mt-8">
        <SectionHeading
          eyebrow="SEARCH ANALYTICS"
          title="Search performance"
          description={`${data?.definitions.searchSession ?? ""} ${data?.definitions.attribution ?? ""}`}
        />
        <div className="grid grid-cols-2 gap-px bg-line md:grid-cols-3 lg:grid-cols-6">
          <StatCard loading={loading} label="Total searches" value={formatNumber(s?.totalSearches ?? 0)} description="Every search event" />
          <StatCard loading={loading} label="Search sessions" value={formatNumber(s?.searchSessions ?? 0)} description={`${(s?.searchesPerSession ?? 0).toFixed(2)} searches per session`} />
          <StatCard loading={loading} label="Search users" value={formatNumber(s?.searchUsers ?? 0)} description="Signed-in customers who searched" />
          <StatCard loading={loading} label="Result rate" value={formatPercent(s?.resultRate ?? 0)} description={`${formatNumber(s?.zeroResultSearches ?? 0)} zero-result searches`} />
          <StatCard loading={loading} label="Unique queries" value={formatNumber(s?.uniqueQueries ?? 0)} description="Distinct normalised terms" />
          <StatCard loading={loading} label="Search-attributed revenue" value={formatCurrency(s?.attributedRevenue ?? 0)} description={`${countOf(s?.attributedOrders ?? 0, "valid order")} after a search`} />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <Panel>
            <PanelHeader eyebrow="SEARCH SESSION FUNNEL" title="What happens after a search" description="Share of search sessions that went on to each step." />
            <div className="p-6 sm:p-8">
              {[
                { label: "Search sessions", value: s?.searchSessions ?? 0, rate: (s?.searchSessions ?? 0) > 0 ? 100 : 0 },
                { label: "Viewed a product", value: s?.sessionsWithView ?? 0, rate: s?.searchToViewRate ?? 0 },
                { label: "Added to bag", value: s?.sessionsWithCart ?? 0, rate: s?.searchToCartRate ?? 0 },
                { label: "Placed an order", value: s?.sessionsWithOrder ?? 0, rate: s?.searchToOrderRate ?? 0 },
              ].map((step) => (
                <div key={step.label} className="border-b border-line py-4 last:border-0">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-bone">{step.label}</span>
                    <span className="font-mono text-xs text-stone">
                      {loading ? "—" : `${formatNumber(step.value)} · `}
                      <span className="text-mango">{loading ? "" : formatPercent(step.rate)}</span>
                    </span>
                  </div>
                  <Bar value={step.rate} />
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelHeader eyebrow="SEARCH TREND" title="Search demand over time" />
            <div className="space-y-5 p-6 sm:p-8">
              {loading ? (
                <p className="py-6 text-center text-sm text-stone">Loading…</p>
              ) : !data || data.trend.length === 0 ? (
                <p className="py-6 text-center text-sm text-stone">No search activity in this period.</p>
              ) : (
                data.trend.map((point) => (
                  <div key={point.date}>
                    <div className="flex items-center justify-between gap-4 text-xs">
                      <span className="text-stone">{formatDayKey(point.date)}</span>
                      <span className="font-mono text-bone">{countOf(point.searches, "search", "searches")} · {countOf(point.searchSessions, "session")}</span>
                    </div>
                    <Bar value={(point.searches / maxSearches) * 100} />
                    <p className="mt-2 text-[11px] text-stone">
                      {countOf(point.uniqueQueries, "unique query", "unique queries")} · {formatNumber(point.zeroResults)} zero-result
                    </p>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>

        <div className="mt-8">
          <Panel>
            <PanelHeader
              eyebrow="TOP SEARCHES"
              title="What customers are looking for"
              description="View, bag and order rates are per search session for that query, so repeat searches by one person don't inflate them."
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px]">
                <thead>
                  <tr className="border-b border-line">
                    <Th>QUERY</Th>
                    <Th>SEARCHES</Th>
                    <Th>SESSIONS</Th>
                    <Th>RESULT RATE</Th>
                    <Th>→ VIEW</Th>
                    <Th>→ BAG</Th>
                    <Th>→ ORDER</Th>
                    <Th align="right">REVENUE</Th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <EmptyRow colSpan={8}>Loading…</EmptyRow>
                  ) : !data || data.topQueries.length === 0 ? (
                    <EmptyRow colSpan={8}>No searches in this period.</EmptyRow>
                  ) : (
                    data.topQueries.map((query) => (
                      <tr key={query.query} className="border-b border-line last:border-0">
                        <td className="px-6 py-4">
                          <p className="text-sm text-bone">{query.query}</p>
                          <p className="mt-1 text-[10px] text-stone">{countOf(query.users, "signed-in customer")}</p>
                        </td>
                        <td className="px-4 py-4 font-mono text-xs text-bone">{formatNumber(query.searches)}</td>
                        <td className="px-4 py-4 font-mono text-xs text-bone">{formatNumber(query.sessions)}</td>
                        <td className="px-4 py-4 font-mono text-xs text-bone">{formatPercent(query.resultRate)}</td>
                        <td className="px-4 py-4 font-mono text-xs text-stone">{formatPercent(query.viewRate)}</td>
                        <td className="px-4 py-4 font-mono text-xs text-stone">{formatPercent(query.cartRate)}</td>
                        <td className="px-4 py-4 font-mono text-xs text-stone">{formatPercent(query.orderRate)}</td>
                        <td className="px-6 py-4 text-right font-mono text-xs text-mango">{formatCurrency(query.revenue)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div className="mt-8">
          <Panel>
            <PanelHeader
              eyebrow="ZERO-RESULT SEARCHES"
              title="Searches that need better coverage"
              description="Queries that returned no products — the clearest signals for missing products, naming gaps or search relevance."
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="border-b border-line">
                    <Th>QUERY</Th>
                    <Th>SEARCHES</Th>
                    <Th>SESSIONS</Th>
                    <Th>ZERO RESULTS</Th>
                    <Th align="right">ZERO-RATE</Th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <EmptyRow colSpan={5}>Loading…</EmptyRow>
                  ) : !data || data.zeroResultQueries.length === 0 ? (
                    <EmptyRow colSpan={5}>No zero-result queries.</EmptyRow>
                  ) : (
                    data.zeroResultQueries.map((query) => (
                      <tr key={query.query} className="border-b border-line last:border-0">
                        <td className="px-6 py-4 text-sm text-bone">{query.query}</td>
                        <td className="px-4 py-4 font-mono text-xs text-bone">{formatNumber(query.searches)}</td>
                        <td className="px-4 py-4 font-mono text-xs text-bone">{formatNumber(query.sessions)}</td>
                        <td className="px-4 py-4 font-mono text-xs text-mango">{formatNumber(query.zeroResultSearches)}</td>
                        <td className="px-6 py-4 text-right font-mono text-xs text-bone">{formatPercent(query.zeroResultRate)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </section>
    </>
  );
}

/* ==========================================================================
 * Product Discovery
 * ========================================================================== */

function ProductThumb({ product }: { product: { image: string; name: string } }) {
  return product.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={product.image} alt={product.name} className="h-12 w-10 shrink-0 object-cover" />
  ) : (
    <div className="h-12 w-10 shrink-0 bg-void" />
  );
}

function ProductRankingCard({
  title,
  description,
  products,
  valueKey,
  valueLabel,
}: {
  title: string;
  description: string;
  products: ProductRow[];
  valueKey: "uniqueViewers" | "wishlistAdds" | "cartAdds" | "unitsSold";
  valueLabel: string;
}) {
  return (
    <Panel>
      <div className="border-b border-line p-6">
        <p className="label-technical text-stone">PRODUCT PERFORMANCE</p>
        <h3 className="mt-2 font-display text-xl text-bone">{title}</h3>
        <p className="mt-2 text-xs leading-relaxed text-stone">{description}</p>
      </div>
      <div>
        {products.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-stone">No data for this period.</p>
        ) : (
          products.slice(0, 10).map((product, index) => (
            <div key={product.productId} className="flex items-center gap-4 border-b border-line px-6 py-4 last:border-0">
              <span className="w-5 font-mono text-[10px] text-stone-dark">{String(index + 1).padStart(2, "0")}</span>
              <ProductThumb product={product} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-bone">{product.name}</p>
                <p className="mt-1 truncate text-[10px] uppercase tracking-[0.1em] text-stone">{product.category}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-xs text-mango">{formatNumber(product[valueKey])}</p>
                <p className="mt-1 text-[9px] uppercase tracking-[0.1em] text-stone-dark">{valueLabel}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

function ProductDiscoverySection({ range }: { range: string }) {
  const { data, loading, error } = useAnalyticsData<ProductData>(
    `/api/admin/user-engagement/products?${rangeQuery(range)}`
  );
  const t = data?.totals;
  const topCategory = data?.categories[0];
  const topRevenueCategory = data ? [...data.categories].sort((a, b) => b.revenue - a.revenue)[0] : undefined;

  return (
    <>
      <ErrorNotice message={error} />
      <section className="mt-8">
        <SectionHeading eyebrow="PRODUCT DISCOVERY" title="What customers discover and what converts" description={data?.definitions.conversion} />
        <div className="grid grid-cols-2 gap-px bg-line md:grid-cols-3 lg:grid-cols-6">
          <StatCard loading={loading} label="Product viewers" value={formatNumber(t?.uniqueViewers ?? 0)} description={`${countOf(t?.views ?? 0, "product view")}`} />
          <StatCard loading={loading} label="Wishlist adds" value={formatNumber(t?.wishlistAdds ?? 0)} />
          <StatCard loading={loading} label="Bag adds" value={formatNumber(t?.cartAdds ?? 0)} />
          <StatCard loading={loading} label="Units sold" value={formatNumber(t?.unitsSold ?? 0)} description={`${countOf(t?.orders ?? 0, "valid order")}`} />
          <StatCard loading={loading} label="Product revenue" value={formatCurrency(t?.productRevenue ?? 0)} description={`After coupons, excl. shipping · orders ${formatCurrency(t?.orderRevenue ?? 0)}`} />
          <StatCard loading={loading} label="Viewer conversion" value={formatPercent(t?.conversionRate ?? 0)} description="Store average: viewers who bought what they viewed" />
        </div>

        <div className="mt-8 grid grid-cols-2 gap-px bg-line md:grid-cols-4">
          <StatCard loading={loading} label="Categories" value={formatNumber(data?.categories.length ?? 0)} description="With products or activity" />
          <StatCard loading={loading} label="Products" value={formatNumber(data?.products.length ?? 0)} description="In the catalogue or with sales" />
          <StatCard loading={loading} label="Top category" value={topCategory?.category ?? "—"} description={topCategory ? `${countOf(topCategory.uniqueViewers, "unique viewer")}` : "No data"} />
          <StatCard loading={loading} label="Top revenue category" value={topRevenueCategory && topRevenueCategory.revenue > 0 ? topRevenueCategory.category : "—"} description={topRevenueCategory ? formatCurrency(topRevenueCategory.revenue) : "No data"} />
        </div>

        <div className="mt-8">
          <Panel>
            <PanelHeader
              eyebrow="CATEGORY PERFORMANCE"
              title="Discovery by category"
              description={`${data?.definitions.wishlistRate ?? ""} ${data?.definitions.cartRate ?? ""}`}
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px]">
                <thead>
                  <tr className="border-b border-line">
                    <Th>CATEGORY</Th>
                    <Th>PRODUCTS</Th>
                    <Th>VIEWERS (VIEWS)</Th>
                    <Th>WISHLIST RATE</Th>
                    <Th>BAG RATE</Th>
                    <Th>UNITS · ORDERS</Th>
                    <Th>CONVERSION</Th>
                    <Th align="right">REVENUE</Th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <EmptyRow colSpan={8}>Loading…</EmptyRow>
                  ) : !data || data.categories.length === 0 ? (
                    <EmptyRow colSpan={8}>No category data for this period.</EmptyRow>
                  ) : (
                    data.categories.map((category) => (
                      <tr key={category.category} className="border-b border-line last:border-0">
                        <td className="px-6 py-4 text-sm text-bone">{category.category}</td>
                        <td className="px-4 py-4 font-mono text-xs text-stone">{formatNumber(category.activeProducts)} / {formatNumber(category.products)} active</td>
                        <td className="px-4 py-4 font-mono text-xs text-bone">{formatNumber(category.uniqueViewers)} ({formatNumber(category.views)})</td>
                        <td className="px-4 py-4 font-mono text-xs text-stone">{formatPercent(category.wishlistRate)}</td>
                        <td className="px-4 py-4 font-mono text-xs text-stone">{formatPercent(category.cartRate)}</td>
                        <td className="px-4 py-4 font-mono text-xs text-bone">{formatNumber(category.unitsSold)} · {formatNumber(category.orders)}</td>
                        <td className="px-4 py-4 font-mono text-xs text-mango">{formatPercent(category.conversionRate)}</td>
                        <td className="px-6 py-4 text-right font-mono text-xs text-mango">{formatCurrency(category.revenue)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div className="mt-8">
          <Panel>
            <PanelHeader eyebrow="DISCOVERY DROP-OFF" title="Categories with high interest, low conversion" description={data?.definitions.dropOff} />
            <div className="px-6 sm:px-8">
              {loading ? (
                <p className="py-6 text-sm text-stone">Loading…</p>
              ) : !data || data.categoryDropOff.length === 0 ? (
                <p className="py-6 text-sm text-stone">No significant category drop-offs detected.</p>
              ) : (
                data.categoryDropOff.map((category) => (
                  <div key={category.category} className="flex items-center justify-between gap-4 border-b border-line py-4 last:border-0">
                    <div>
                      <p className="text-sm text-bone">{category.category}</p>
                      <p className="mt-1 text-[10px] text-stone">{countOf(category.uniqueViewers, "viewer")} · {formatPercent(category.cartRate)} bag rate</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-xs text-mango">{formatPercent(category.conversionRate)}</p>
                      <p className="mt-1 text-[10px] text-stone">avg {formatPercent(data.totals.conversionRate)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>
      </section>

      <section className="mt-12">
        <SectionHeading eyebrow="PRODUCT ENGAGEMENT" title="Product performance" description={data?.definitions.revenue} />
        <Panel>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1150px]">
              <thead>
                <tr className="border-b border-line">
                  <Th>PRODUCT</Th>
                  <Th>VIEWERS (VIEWS)</Th>
                  <Th>WISHLIST</Th>
                  <Th>BAG</Th>
                  <Th>UNITS SOLD</Th>
                  <Th>ORDERS</Th>
                  <Th>CONVERSION</Th>
                  <Th align="right">REVENUE</Th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <EmptyRow colSpan={8}>Loading…</EmptyRow>
                ) : !data || data.mostEngaged.length === 0 ? (
                  <EmptyRow colSpan={8}>No product engagement in this period.</EmptyRow>
                ) : (
                  data.mostEngaged.map((product) => (
                    <tr key={product.productId} className="border-b border-line last:border-0">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <ProductThumb product={product} />
                          <div className="min-w-0">
                            <p className="truncate text-sm text-bone">{product.name}</p>
                            <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-stone">
                              {product.category}
                              {!product.inCatalog && " · no longer listed"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-mono text-xs text-bone">{formatNumber(product.uniqueViewers)} ({formatNumber(product.views)})</td>
                      <td className="px-4 py-4 font-mono text-xs text-bone">{formatNumber(product.wishlistAdds)}</td>
                      <td className="px-4 py-4 font-mono text-xs text-bone">{formatNumber(product.cartAdds)}</td>
                      <td className="px-4 py-4 font-mono text-xs text-bone">{formatNumber(product.unitsSold)}</td>
                      <td className="px-4 py-4 font-mono text-xs text-bone">{formatNumber(product.orders)}</td>
                      <td className="px-4 py-4 font-mono text-xs text-mango">{formatPercent(product.conversionRate)}</td>
                      <td className="px-6 py-4 text-right font-mono text-xs text-mango">{formatCurrency(product.revenue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <ProductRankingCard title="Most viewed" description="Products seen by the most unique visitors." products={data?.mostViewed ?? []} valueKey="uniqueViewers" valueLabel="viewers" />
          <ProductRankingCard title="Most wishlisted" description="Products customers want to come back to." products={data?.mostWishlisted ?? []} valueKey="wishlistAdds" valueLabel="adds" />
          <ProductRankingCard title="Most added to bag" description="Products creating the strongest buying intent." products={data?.mostAddedToCart ?? []} valueKey="cartAdds" valueLabel="bag adds" />
          <ProductRankingCard title="Most purchased" description="Products with the most units sold (valid orders)." products={data?.mostPurchased ?? []} valueKey="unitsSold" valueLabel="units" />
        </div>

        <div className="mt-8">
          <Panel>
            <PanelHeader
              eyebrow="ATTENTION REQUIRED"
              title="High interest, low conversion"
              description={`${data?.definitions.dropOff ?? ""} They may need better pricing, product information, imagery or offers.`}
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead>
                  <tr className="border-b border-line">
                    <Th>PRODUCT</Th>
                    <Th>VIEWERS</Th>
                    <Th>BAG RATE</Th>
                    <Th>UNITS SOLD</Th>
                    <Th align="right">CONVERSION</Th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <EmptyRow colSpan={5}>Loading…</EmptyRow>
                  ) : !data || data.highInterestLowConversion.length === 0 ? (
                    <EmptyRow colSpan={5}>No high-interest, low-conversion products.</EmptyRow>
                  ) : (
                    data.highInterestLowConversion.map((product) => (
                      <tr key={product.productId} className="border-b border-line last:border-0">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <ProductThumb product={product} />
                            <div className="min-w-0">
                              <p className="truncate text-sm text-bone">{product.name}</p>
                              <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-stone">{product.category}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 font-mono text-xs text-bone">{formatNumber(product.uniqueViewers)}</td>
                        <td className="px-4 py-4 font-mono text-xs text-bone">{formatPercent(product.cartRate)}</td>
                        <td className="px-4 py-4 font-mono text-xs text-bone">{formatNumber(product.unitsSold)}</td>
                        <td className="px-6 py-4 text-right font-mono text-xs text-mango">{formatPercent(product.conversionRate)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </section>
    </>
  );
}

/* ==========================================================================
 * Customer Profile modal
 *
 * ONE scroll container: the full-screen overlay scrolls; nothing inside it
 * has its own vertical scroll. data-lenis-prevent stops the site's smooth
 * scroll from capturing the wheel, and overscroll-contain stops the page
 * behind from scrolling.
 * ========================================================================== */

function profileUrl(target: ProfileTarget, range: string, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({ range, ...extra });
  if (target.userId) params.set("userId", target.userId);
  else if (target.email) params.set("email", target.email);
  return `/api/admin/user-engagement/customer?${params.toString()}`;
}

function CustomerProfileModal({
  target,
  range,
  onClose,
}: {
  target: ProfileTarget;
  range: string;
  onClose: () => void;
}) {
  const { data, error, loading } = useAnalyticsData<ProfileData>(profileUrl(target, range));
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      root.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const title = data?.customer.name || "Customer profile";

  return (
    <div
      className="fixed inset-0 z-[9999] overflow-y-auto overscroll-contain bg-void/90 backdrop-blur-sm"
      data-lenis-prevent
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="mx-auto my-4 w-[calc(100%-2rem)] max-w-6xl border border-line bg-charcoal shadow-2xl sm:my-8">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-5 border-b border-line bg-charcoal p-6 sm:p-8">
          <div className="min-w-0">
            <p className="label-technical text-stone">CUSTOMER PROFILE</p>
            <h2 className="mt-2 truncate font-display text-3xl text-bone">
              {title}
              {data?.customer.isGuest && <GuestTag />}
            </h2>
            <p className="mt-2 truncate text-sm text-stone">
              {data ? data.customer.email || data.customer.mobile || data.customer.id : target.email || target.userId}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="shrink-0 border border-line-strong px-4 py-2 text-[10px] tracking-[0.14em] text-stone hover:text-bone"
          >
            CLOSE
          </button>
        </div>

        {error ? (
          <p className="p-8 text-sm text-mango">{error}</p>
        ) : loading || !data ? (
          <p className="p-8 text-sm text-stone">Loading customer profile…</p>
        ) : (
          <ProfileBody data={data} target={target} range={range} />
        )}
      </div>
    </div>
  );
}

function ProfileStatGrid({ items }: { items: [string, string][] }) {
  return (
    <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4 lg:grid-cols-7">
      {items.map(([label, value]) => (
        <div key={label} className="bg-void p-4 last:col-span-2 lg:last:col-span-1">
          <p className="label-technical text-stone">{label}</p>
          <p className="mt-3 break-words font-display text-xl text-bone">{value}</p>
        </div>
      ))}
    </div>
  );
}

function ProfileBody({ data, target, range }: { data: ProfileData; target: ProfileTarget; range: string }) {
  const [showAllViewed, setShowAllViewed] = useState(false);
  const life = data.summary.lifetime;
  const period = data.summary.period;
  const definitions = data.segmentDefinitions;
  const viewed = showAllViewed ? data.viewedProducts : data.viewedProducts.slice(0, 10);

  return (
    <div>
      <div className="border-b border-line px-6 pt-6 sm:px-8">
        <p className="label-technical mb-3 text-stone">LIFETIME</p>
      </div>
      <ProfileStatGrid
        items={[
          ["SESSIONS", formatNumber(life.sessions)],
          ["PRODUCT VIEWS", formatNumber(life.productViews)],
          ["WISHLIST ADDS", formatNumber(life.wishlistAdds)],
          ["BAG ADDS", formatNumber(life.cartAdds)],
          ["ORDERS", formatNumber(life.orders)],
          ["LTV", formatCurrency(data.summary.ltv)],
          ["AVG ORDER", formatCurrency(life.averageOrderValue)],
        ]}
      />

      <div className="border-b border-line px-6 pt-6 sm:px-8">
        <p className="label-technical mb-3 text-stone">SELECTED PERIOD · {data.period.label.toUpperCase()}</p>
      </div>
      <ProfileStatGrid
        items={[
          ["SESSIONS", formatNumber(period.sessions)],
          ["PRODUCT VIEWS", formatNumber(period.productViews)],
          ["WISHLIST ADDS", formatNumber(period.wishlistAdds)],
          ["BAG ADDS", formatNumber(period.cartAdds)],
          ["ORDERS", formatNumber(period.orders)],
          ["REVENUE", formatCurrency(period.revenue)],
          ["SCORE", `${data.summary.engagementScore}/100`],
        ]}
      />

      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-2">
        <div className="space-y-8">
          <div>
            <p className="label-technical text-stone">CUSTOMER DETAILS</p>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-xs">
              {[
                ["First recorded activity", formatDateTime(data.summary.firstActivityAt)],
                ["Last active", formatDateTime(data.summary.lastActiveAt)],
                [data.customer.isGuest ? "First order" : "Joined", formatDate(data.summary.joinedAt)],
                ["Last sign-in", data.customer.isGuest ? "Guest checkout" : formatDateTime(data.customer.lastLoginAt)],
                ["Mobile", data.customer.mobile || "—"],
                ["Email verified", data.customer.isGuest ? "—" : data.customer.emailVerified ? "Yes" : "No"],
                ["Primary segment", data.summary.segment.label],
                ["Cancelled / failed orders", formatNumber(life.cancelledOrders)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-stone">{label}</dt>
                  <dd className={`mt-1 ${label === "Primary segment" ? "text-mango" : "text-bone"}`}>{value}</dd>
                </div>
              ))}
            </dl>
            {data.summary.segments.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {data.summary.segments.map((key) => {
                  const definition = definitions.find((item) => item.key === key);
                  return (
                    <span key={key} title={definition?.description} className="inline-flex items-center gap-2 border border-line px-2 py-1 text-[11px] text-bone">
                      {definition?.label ?? key}
                      {definition && <ScopeTag scope={definition.scope} />}
                    </span>
                  );
                })}
              </div>
            )}
            {data.definitions.guestActivity && <p className="mt-4 text-[11px] leading-relaxed text-stone">{data.definitions.guestActivity}</p>}
          </div>

          <div>
            <p className="label-technical text-stone">ORDERS ({formatNumber(data.orders.length)})</p>
            <p className="mt-1 text-[11px] text-stone">{data.definitions.validOrders}</p>
            <div className="mt-3 divide-y divide-line border border-line">
              {data.orders.length === 0 ? (
                <p className="p-5 text-sm text-stone">No orders.</p>
              ) : (
                data.orders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs text-mango">{order.id}</p>
                      <p className="mt-1 text-[10px] text-stone">
                        {formatDateTime(order.createdAt)} · {countOf(order.itemCount, "item")} · {order.status} · payment {order.paymentStatus}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`font-mono text-xs ${order.countsAsRevenue ? "text-bone" : "text-stone line-through"}`}>{formatCurrency(order.total)}</p>
                      {!order.countsAsRevenue && <p className="mt-1 text-[9px] tracking-[0.1em] text-stone">NOT IN REVENUE</p>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        <div className="space-y-8">
          <div>
            <p className="label-technical text-stone">WISHLIST ({formatNumber(data.wishlist.length)})</p>
            <div className="mt-3 divide-y divide-line border border-line">
              {data.customer.isGuest ? (
                <p className="p-5 text-sm text-stone">Guests can’t keep a wishlist.</p>
              ) : data.wishlist.length === 0 ? (
                <p className="p-5 text-sm text-stone">No wishlist items.</p>
              ) : (
                data.wishlist.map((item) => (
                  <div key={`${item.productId}-${item.addedAt}`} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-bone">{item.name}</p>
                      <p className="mt-1 text-[10px] text-stone">{item.folder} · saved {formatDate(item.addedAt)}</p>
                    </div>
                    <p className="shrink-0 font-mono text-xs text-mango">{formatCurrency(item.priceAtSave)}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <p className="label-technical text-stone">PRODUCTS VIEWED ({formatNumber(data.viewedProducts.length)})</p>
            <div className="mt-3 divide-y divide-line border border-line">
              {data.viewedProducts.length === 0 ? (
                <p className="p-5 text-sm text-stone">No product views recorded.</p>
              ) : (
                viewed.map((item) => (
                  <div key={item.productId} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-bone">{item.name}</p>
                      <p className="mt-1 text-[10px] text-stone">Last viewed {formatDateTime(item.lastViewedAt)}</p>
                    </div>
                    <p className="shrink-0 font-mono text-xs text-bone">{countOf(item.views, "view")}</p>
                  </div>
                ))
              )}
            </div>
            {data.viewedProducts.length > 10 && (
              <button
                type="button"
                onClick={() => setShowAllViewed((value) => !value)}
                className="mt-3 border border-line-strong px-4 py-2 text-[10px] tracking-[0.14em] text-stone hover:text-bone"
              >
                {showAllViewed ? "SHOW TOP 10" : `SHOW ALL ${formatNumber(data.viewedProducts.length)}`}
              </button>
            )}
          </div>
        </div>

      </div>

      <div className="border-t border-line p-6 sm:p-8">
        <ProfileTimeline initial={data.timeline} target={target} range={range} />
      </div>
    </div>
  );
}

function describeTimelineEvent(event: TimelineEvent) {
  const parts: string[] = [];
  if (event.productName || event.productId) parts.push(event.productName || event.productId);
  if (event.searchQuery) parts.push(`“${event.searchQuery}”`);

  const details = event.details;
  if (event.event === "purchase" && details.orderId) parts.push(`Order ${details.orderId}`);
  if (typeof details.total === "number" && event.event === "purchase") parts.push(formatCurrency(details.total));
  if (typeof details.quantity === "number" && (event.event === "cart_add" || event.event === "cart_remove")) parts.push(`qty ${details.quantity}`);
  if (typeof details.couponCode === "string" && details.couponCode && event.event === "coupon_apply") parts.push(details.couponCode);
  if (typeof details.resultCount === "number") parts.push(`${details.resultCount} results`);
  if (typeof details.source === "string") parts.push(details.source.replaceAll("_", " "));
  if (event.path && event.event === "page_view") parts.push(event.path);

  return parts.join(" · ");
}

/** Complete activity timeline, loaded 50 events at a time (no inner scroll). */
function ProfileTimeline({ initial, target, range }: { initial: TimelinePage; target: ProfileTarget; range: string }) {
  const [events, setEvents] = useState(initial.events);
  const [nextOffset, setNextOffset] = useState(initial.nextOffset);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function loadMore() {
    if (nextOffset === null) return;
    setLoadingMore(true);
    setLoadError(null);
    try {
      const page = await fetchJson<TimelinePage>(
        profileUrl(target, range, { timeline: "1", offset: String(nextOffset), asOf: initial.asOf })
      );
      setEvents((current) => {
        const seen = new Set(current.map((event) => event.id));
        return [...current, ...page.events.filter((event) => !seen.has(event.id))];
      });
      setNextOffset(page.nextOffset);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Unable to load more activity.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div>
      <p className="label-technical text-stone">ACTIVITY TIMELINE</p>
      <p className="mt-1 text-[11px] text-stone">
        Showing {formatNumber(events.length)} of {formatNumber(initial.total)} recorded events, newest first.
      </p>
      <div className="mt-4 border border-line">
        {events.length === 0 ? (
          <p className="p-5 text-sm text-stone">No tracked activity.</p>
        ) : (
          events.map((event) => {
            const detail = describeTimelineEvent(event);
            return (
              <div key={event.id} className="border-b border-line p-4 last:border-0">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-xs capitalize text-bone">{humanizeEvent(event.event)}</p>
                  <p className="shrink-0 font-mono text-[10px] text-stone">{formatDateTime(event.createdAt)}</p>
                </div>
                {detail && <p className="mt-1 break-words text-[10px] text-stone">{detail}</p>}
              </div>
            );
          })
        )}
      </div>
      {loadError && <p className="mt-3 text-xs text-mango">{loadError}</p>}
      {nextOffset !== null && (
        <button
          type="button"
          onClick={() => void loadMore()}
          disabled={loadingMore}
          className="mt-4 w-full border border-line-strong py-3 text-[10px] tracking-[0.14em] text-bone transition-colors hover:border-bone disabled:opacity-50"
        >
          {loadingMore ? "LOADING…" : `LOAD MORE (${formatNumber(initial.total - events.length)} MORE)`}
        </button>
      )}
    </div>
  );
}
