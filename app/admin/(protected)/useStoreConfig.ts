"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Loads / saves one store setting (Admin → Size Guide, Delivery, Returns,
 * Reminders) through /api/admin/store-config/[key].
 */
export function useStoreConfig<T>(key: string) {
  const [value, setValue] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/store-config/${key}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Failed to load settings.");
        if (!cancelled) setValue(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load settings.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const update = useCallback((updates: Partial<T>) => {
    setValue((current) => (current ? { ...current, ...updates } : current));
    setSaved(false);
    setError(null);
  }, []);

  const save = useCallback(async () => {
    if (!value) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch(`/api/admin/store-config/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Failed to save.");
      setValue(data);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }, [key, value]);

  return { value, setValue, update, save, loading, saving, error, saved };
}

export const adminInputClass =
  "w-full border border-line-strong bg-transparent px-3.5 py-2.5 text-sm text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none";

export const adminButtonClass =
  "bg-bone px-6 py-3 text-xs font-medium tracking-[0.2em] text-void transition-colors hover:bg-mango disabled:cursor-not-allowed disabled:opacity-50";
