"use client";

import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

type CouponDiscountType = "percentage" | "fixed";

type Coupon = {
  id: string;
  code: string;
  enabled: boolean;
  discountType: CouponDiscountType;
  discountValue: number;
  minOrderValue: number;
  maxDiscount: number;
  startsAt: string;
  expiresAt: string;
  usageLimit: number;
  usageCount: number;
};

const EMPTY_COUPON: Omit<Coupon, "id"> = {
  code: "",
  enabled: true,
  discountType: "percentage",
  discountValue: 10,
  minOrderValue: 0,
  maxDiscount: 0,
  startsAt: "",
  expiresAt: "",
  usageLimit: 0,
  usageCount: 0,
};

const inputClass =
  "w-full border border-line-strong bg-transparent px-3.5 py-2.5 text-sm text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function getLocalDateValue(date = new Date()) {
  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(date.getDate())}`;
}

/**
 * Convert API/local stored datetime to Date.
 *
 * Supported:
 * 2026-09-05T14:30
 * 2026-09-05T14:30:00
 * ISO strings with timezone
 */
function parseDateTime(value: string): Date | null {
  if (!value) {
    return null;
  }

  const localMatch = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
  );

  if (localMatch) {
    const year = Number(localMatch[1]);
    const month = Number(localMatch[2]) - 1;
    const day = Number(localMatch[3]);
    const hour = Number(localMatch[4]);
    const minute = Number(localMatch[5]);

    const date = new Date(
      year,
      month,
      day,
      hour,
      minute,
      0,
      0
    );

    return Number.isNaN(date.getTime())
      ? null
      : date;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function formatDateTime(date: Date | null): string {
  if (!date) {
    return "";
  }

  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function normalizeDateTime(value: unknown): string {
  if (!value || typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  const localMatch = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
  );

  if (localMatch) {
    return trimmed;
  }

  const secondsMatch = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/
  );

  if (secondsMatch) {
    return `${secondsMatch[1]}-${secondsMatch[2]}-${secondsMatch[3]}T${secondsMatch[4]}:${secondsMatch[5]}`;
  }

  const date = new Date(trimmed);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return formatDateTime(date);
}

function normalizeCoupon(coupon: Coupon): Coupon {
  let startsAt = normalizeDateTime(
    coupon.startsAt
  );
  let expiresAt = normalizeDateTime(
    coupon.expiresAt
  );

  const today = getLocalDateValue();

  if (
    startsAt &&
    startsAt.slice(0, 10) < today
  ) {
    startsAt = "";
  }

  if (
    expiresAt &&
    expiresAt.slice(0, 10) < today
  ) {
    expiresAt = "";
  }

  if (
    startsAt &&
    expiresAt &&
    expiresAt < startsAt
  ) {
    expiresAt = startsAt;
  }

  return {
    ...coupon,
    code: String(coupon.code || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, ""),
    enabled: Boolean(coupon.enabled),
    discountType:
      coupon.discountType === "fixed"
        ? "fixed"
        : "percentage",
    discountValue: Math.max(
      0,
      Number(coupon.discountValue) || 0
    ),
    minOrderValue: Math.max(
      0,
      Number(coupon.minOrderValue) || 0
    ),
    maxDiscount: Math.max(
      0,
      Number(coupon.maxDiscount) || 0
    ),
    startsAt,
    expiresAt,
    usageLimit: Math.max(
      0,
      Math.floor(
        Number(coupon.usageLimit) || 0
      )
    ),
    usageCount: Math.max(
      0,
      Math.floor(
        Number(coupon.usageCount) || 0
      )
    ),
  };
}

function createCoupon(): Coupon {
  return {
    id: `coupon-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 9)}`,
    ...EMPTY_COUPON,
  };
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>(
    []
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(
    null
  );

  const [today, setToday] = useState("");

  useEffect(() => {
    setToday(getLocalDateValue());
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCoupons() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          "/api/admin/coupons",
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const data = await response
          .json()
          .catch(() => null);

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "Failed to load coupons."
          );
        }

        if (!cancelled) {
          const loaded = Array.isArray(data)
            ? data.map(
                (coupon: Coupon) =>
                  normalizeCoupon(coupon)
              )
            : [];

          setCoupons(loaded);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load coupons."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadCoupons();

    return () => {
      cancelled = true;
    };
  }, []);

  function updateCoupon(
    index: number,
    updates: Partial<Coupon>
  ) {
    setCoupons((current) =>
      current.map((coupon, couponIndex) => {
        if (couponIndex !== index) {
          return coupon;
        }

        return normalizeCoupon({
          ...coupon,
          ...updates,
        });
      })
    );

    setSaved(false);
    setError(null);
  }

  function addCoupon() {
    setCoupons((current) => [
      ...current,
      createCoupon(),
    ]);

    setSaved(false);
    setError(null);
  }

  function removeCoupon(index: number) {
    setCoupons((current) =>
      current.filter(
        (_, couponIndex) =>
          couponIndex !== index
      )
    );

    setSaved(false);
    setError(null);
  }

  function resetUsage(index: number) {
    updateCoupon(index, {
      usageCount: 0,
    });
  }

  function handleStartDateChange(
    index: number,
    date: Date | null
  ) {
    if (!date) {
      updateCoupon(index, {
        startsAt: "",
      });
      return;
    }

    const selected = formatDateTime(date);

    if (
      today &&
      selected.slice(0, 10) < today
    ) {
      return;
    }

    const coupon = coupons[index];

    if (!coupon) {
      return;
    }

    let expiresAt = coupon.expiresAt;

    if (
      expiresAt &&
      expiresAt < selected
    ) {
      expiresAt = selected;
    }

    updateCoupon(index, {
      startsAt: selected,
      expiresAt,
    });
  }

  function handleExpiryDateChange(
    index: number,
    date: Date | null
  ) {
    if (!date) {
      updateCoupon(index, {
        expiresAt: "",
      });
      return;
    }

    const selected = formatDateTime(date);
    const coupon = coupons[index];

    if (!coupon) {
      return;
    }

    if (
      today &&
      selected.slice(0, 10) < today
    ) {
      return;
    }

    if (
      coupon.startsAt &&
      selected < coupon.startsAt
    ) {
      return;
    }

    updateCoupon(index, {
      expiresAt: selected,
    });
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const normalizedCoupons =
        coupons.map(normalizeCoupon);

      const codes = new Set<string>();

      for (const coupon of normalizedCoupons) {
        if (!coupon.code) {
          throw new Error(
            "Every coupon must have a coupon code."
          );
        }

        if (codes.has(coupon.code)) {
          throw new Error(
            `Duplicate coupon code: ${coupon.code}`
          );
        }

        codes.add(coupon.code);

        if (coupon.discountValue <= 0) {
          throw new Error(
            `Coupon ${coupon.code} must have a discount greater than 0.`
          );
        }

        if (
          coupon.discountType ===
            "percentage" &&
          coupon.discountValue > 100
        ) {
          throw new Error(
            `Coupon ${coupon.code} percentage cannot be greater than 100.`
          );
        }

        if (
          coupon.startsAt &&
          today &&
          coupon.startsAt.slice(0, 10) <
            today
        ) {
          throw new Error(
            `Start date for ${coupon.code} cannot be in the past.`
          );
        }

        if (
          coupon.expiresAt &&
          today &&
          coupon.expiresAt.slice(0, 10) <
            today
        ) {
          throw new Error(
            `Expiry date for ${coupon.code} cannot be in the past.`
          );
        }

        if (
          coupon.startsAt &&
          coupon.expiresAt &&
          coupon.expiresAt < coupon.startsAt
        ) {
          throw new Error(
            `Expiry date for ${coupon.code} cannot be before the start date.`
          );
        }

        if (
          coupon.usageLimit > 0 &&
          coupon.usageCount >
            coupon.usageLimit
        ) {
          throw new Error(
            `Usage count for ${coupon.code} cannot exceed its usage limit.`
          );
        }
      }

      const response = await fetch(
        "/api/admin/coupons",
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            coupons: normalizedCoupons,
          }),
        }
      );

      const data = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Failed to save coupons."
        );
      }

      const savedCoupons = Array.isArray(data)
        ? data.map(
            (coupon: Coupon) =>
              normalizeCoupon(coupon)
          )
        : normalizedCoupons;

      setCoupons(savedCoupons);
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save coupons."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div>
        <p className="label-technical mb-2">
          COUPONS
        </p>

        <h1 className="font-display text-3xl tracking-tight text-bone">
          Coupons
        </h1>

        <p className="mt-8 text-sm text-stone">
          Loading…
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* PAGE HEADER */}
      <div className="mb-10 flex items-start justify-between gap-5">
        <div>
          <p className="label-technical mb-2">
            COUPONS
          </p>

          <h1 className="font-display text-3xl tracking-tight text-bone">
            Coupons
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone">
            Create and manage discount codes
            used during checkout.
          </p>
        </div>

        <button
          type="button"
          onClick={addCoupon}
          className="shrink-0 border border-line-strong px-4 py-2.5 text-xs tracking-[0.12em] text-bone transition-colors hover:border-mango hover:text-mango"
        >
          + ADD COUPON
        </button>
      </div>

      {/* EMPTY STATE */}
      {coupons.length === 0 ? (
        <div className="border border-dashed border-line-strong px-5 py-16 text-center">
          <p className="text-sm text-stone">
            No coupons configured.
          </p>

          <p className="mt-1 text-xs text-stone-dark">
            Add a coupon to enable discount
            codes at checkout.
          </p>
        </div>
      ) : (
        <div className="flex max-w-5xl flex-col gap-6">
          {coupons.map((coupon, index) => {
            const startDate =
              parseDateTime(
                coupon.startsAt
              );

            const expiryDate =
              parseDateTime(
                coupon.expiresAt
              );

            const minStartDate = new Date();

            const minExpiryDate =
              startDate &&
              startDate > minStartDate
                ? startDate
                : minStartDate;

            return (
              <section
                key={coupon.id}
                className="border border-line-strong p-6 sm:p-8"
              >
                {/* COUPON HEADER */}
                <div className="mb-7 flex items-start justify-between gap-4">
                  <div>
                    <p className="label-technical mb-2">
                      COUPON{" "}
                      {String(index + 1).padStart(
                        2,
                        "0"
                      )}
                    </p>

                    <h2 className="font-display text-xl text-bone">
                      {coupon.code ||
                        "NEW COUPON"}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      removeCoupon(index)
                    }
                    className="text-xs text-stone transition-colors hover:text-mango"
                  >
                    REMOVE
                  </button>
                </div>

                <div className="flex flex-col gap-5">
                  {/* ENABLE */}
                  <label className="flex items-center gap-3 text-sm text-bone-dim">
                    <input
                      type="checkbox"
                      checked={coupon.enabled}
                      onChange={(e) =>
                        updateCoupon(
                          index,
                          {
                            enabled:
                              e.target
                                .checked,
                          }
                        )
                      }
                      className="h-4 w-4 accent-[color:var(--color-mango)]"
                    />

                    Coupon enabled
                  </label>

                  {/* BASIC SETTINGS */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* CODE */}
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs text-stone">
                        Coupon code
                      </span>

                      <input
                        type="text"
                        value={coupon.code}
                        onChange={(e) =>
                          updateCoupon(
                            index,
                            {
                              code: e.target.value
                                .toUpperCase()
                                .replace(
                                  /\s+/g,
                                  ""
                                ),
                            }
                          )
                        }
                        placeholder="WELCOME10"
                        className={
                          inputClass
                        }
                      />
                    </label>

                    {/* TYPE */}
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs text-stone">
                        Discount type
                      </span>

                      <select
                        value={
                          coupon.discountType
                        }
                        onChange={(e) =>
                          updateCoupon(
                            index,
                            {
                              discountType:
                                e.target
                                  .value as CouponDiscountType,
                              maxDiscount:
                                e.target
                                  .value ===
                                "fixed"
                                  ? 0
                                  : coupon.maxDiscount,
                            }
                          )
                        }
                        className={
                          inputClass
                        }
                      >
                        <option value="percentage">
                          Percentage (%)
                        </option>

                        <option value="fixed">
                          Fixed amount
                        </option>
                      </select>
                    </label>

                    {/* DISCOUNT */}
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs text-stone">
                        {coupon.discountType ===
                        "percentage"
                          ? "Discount percentage"
                          : "Discount amount"}
                      </span>

                      <input
                        type="number"
                        min="0"
                        max={
                          coupon.discountType ===
                          "percentage"
                            ? 100
                            : undefined
                        }
                        step="0.01"
                        value={
                          coupon.discountValue
                        }
                        onChange={(e) =>
                          updateCoupon(
                            index,
                            {
                              discountValue:
                                Math.max(
                                  0,
                                  Number(
                                    e.target
                                      .value
                                  ) || 0
                                ),
                            }
                          )
                        }
                        className={
                          inputClass
                        }
                      />
                    </label>

                    {/* MINIMUM ORDER */}
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs text-stone">
                        Minimum order value
                      </span>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          coupon.minOrderValue
                        }
                        onChange={(e) =>
                          updateCoupon(
                            index,
                            {
                              minOrderValue:
                                Math.max(
                                  0,
                                  Number(
                                    e.target
                                      .value
                                  ) || 0
                                ),
                            }
                          )
                        }
                        className={
                          inputClass
                        }
                      />
                    </label>

                    {/* MAX DISCOUNT */}
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs text-stone">
                        Maximum discount
                      </span>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          coupon.maxDiscount
                        }
                        disabled={
                          coupon.discountType ===
                          "fixed"
                        }
                        onChange={(e) =>
                          updateCoupon(
                            index,
                            {
                              maxDiscount:
                                Math.max(
                                  0,
                                  Number(
                                    e.target
                                      .value
                                  ) || 0
                                ),
                            }
                          )
                        }
                        className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-40`}
                      />

                      <span className="text-xs text-stone-dark">
                        0 = no maximum.
                        Used for percentage
                        coupons.
                      </span>
                    </label>

                    {/* USAGE LIMIT */}
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs text-stone">
                        Usage limit
                      </span>

                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={
                          coupon.usageLimit
                        }
                        onChange={(e) =>
                          updateCoupon(
                            index,
                            {
                              usageLimit:
                                Math.max(
                                  0,
                                  Math.floor(
                                    Number(
                                      e.target
                                        .value
                                    ) || 0
                                  )
                                ),
                            }
                          )
                        }
                        className={
                          inputClass
                        }
                      />

                      <span className="text-xs text-stone-dark">
                        0 = unlimited uses.
                      </span>
                    </label>
                  </div>

                  {/* DATE PICKERS */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* START */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs text-stone">
                        Starts at
                      </span>

                      <DatePicker
                        selected={startDate}
                       onChange={(date: Date | null) =>
  handleStartDateChange(
    index,
    date
  )
}
                        minDate={
                          new Date()
                        }
                        showTimeSelect
                        timeIntervals={15}
                        dateFormat="dd-MM-yyyy h:mm aa"
                        placeholderText="DD-MM-YYYY  --:--"
                        isClearable
                        className={
                          inputClass
                        }
                        popperClassName="mangosta-datepicker-popper"
                        calendarClassName="mangosta-datepicker"
                      />

                      <span className="text-xs text-stone-dark">
                        Today and future
                        dates only.
                      </span>
                    </div>

                    {/* EXPIRY */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs text-stone">
                        Expires at
                      </span>

                      <DatePicker
                        selected={expiryDate}
                        onChange={(date: Date | null) =>
  handleExpiryDateChange(
    index,
    date
  )
}
                        minDate={
                          minExpiryDate
                        }
                        showTimeSelect
                        timeIntervals={15}
                        dateFormat="dd-MM-yyyy h:mm aa"
                        placeholderText="DD-MM-YYYY  --:--"
                        isClearable
                        className={
                          inputClass
                        }
                        popperClassName="mangosta-datepicker-popper"
                        calendarClassName="mangosta-datepicker"
                      />

                      <span className="text-xs text-stone-dark">
                        Must be on or after
                        the start date.
                      </span>
                    </div>
                  </div>

                  {/* USAGE */}
                  <div className="border border-line bg-charcoal p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                      <span className="text-stone">
                        Usage
                      </span>

                      <span className="font-mono text-bone">
                        {coupon.usageCount} /{" "}
                        {coupon.usageLimit === 0
                          ? "∞"
                          : coupon.usageLimit}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        resetUsage(index)
                      }
                      className="mt-3 text-xs text-stone transition-colors hover:text-mango"
                    >
                      RESET USAGE COUNT
                    </button>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* SAVE AREA */}
      <div className="mt-10 flex max-w-5xl flex-col gap-4">
        {error && (
          <p
            role="alert"
            className="text-sm text-mango"
          >
            {error}
          </p>
        )}

        {saved && (
          <p className="text-sm text-mango">
            Coupons saved successfully.
          </p>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-bone py-4 text-center text-xs font-medium tracking-[0.2em] text-void transition-colors hover:bg-mango disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving
            ? "SAVING…"
            : "SAVE COUPONS"}
        </button>
      </div>
    </div>
  );
}