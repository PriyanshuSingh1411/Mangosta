"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Login failed.");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-void px-6">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center gap-4 text-center">
          <div className="relative h-10 w-14">
            <Image src="/images/mark-white.png" alt="" fill sizes="56px" className="object-contain" />
          </div>
          <div>
            <p className="label-technical mb-2">MANGOSTA ADMIN</p>
            <h1 className="font-display text-3xl tracking-tight text-bone">Sign in</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="password" className="label-technical mb-2 block">
              PASSWORD
            </label>
            <input
              id="password"
              type="password"
              required
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-line-strong bg-transparent px-4 py-3.5 text-sm text-bone placeholder:text-stone-dark focus:outline-none focus:border-bone"
              placeholder="Enter admin password"
            />
          </div>

          {error && (
            <p role="alert" className="text-xs text-mango">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 bg-bone py-3.5 text-center text-xs font-medium tracking-[0.2em] text-void transition-colors hover:bg-mango disabled:opacity-50"
          >
            {isLoading ? "SIGNING IN…" : "SIGN IN"}
          </button>
        </form>
      </div>
    </div>
  );
}
