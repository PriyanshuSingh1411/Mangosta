"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/app/components/AuthProvider";
type ProductQuestion = {
  id: string;
  productId: string;
  userId: string;
  authorName: string;
  question: string;
  answer?: string;
  answeredAt?: string;
  createdAt: string;
};

export default function ProductQuestions({ productId }: { productId: string }) {
  const { user, loading: authLoading, openAuth } = useAuth();
  const [questions, setQuestions] = useState<ProductQuestion[]>([]);
  const [question, setQuestion] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    fetch(`/api/product-questions?productId=${encodeURIComponent(productId)}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setQuestions(data?.questions || []))
      .catch(() => undefined);
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) {
      openAuth("signin");
      return;
    }
    setSaving(true);
    setError("");
    const response = await fetch("/api/product-questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, question }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) setError(data?.error || "Unable to submit your question.");
    else {
      setQuestion("");
      load();
    }
    setSaving(false);
  };

  return (
    <div aria-label="Product questions">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:gap-12">
        <div>
          <p className="text-sm leading-relaxed text-stone">
            Ask about fit, fabric, sizing or anything else. Mangosta can answer from the product side.
          </p>
          <form onSubmit={submit} className="mt-5">
            <label htmlFor={`question-${productId}`} className="sr-only">
              Your question
            </label>
            <textarea
              id={`question-${productId}`}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={4}
              className="w-full resize-y border border-line-strong bg-charcoal px-3 py-3 text-sm text-bone"
              placeholder="Is this oversized?"
            />
            {error && (
              <p role="alert" className="mt-2 text-xs text-mango">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={authLoading || saving}
              className="mt-3 border border-line-strong px-5 py-3 text-xs tracking-[0.16em] text-bone transition-colors hover:border-bone hover:bg-bone hover:text-void disabled:opacity-50"
            >
              {user ? (saving ? "SENDING…" : "ASK QUESTION") : "SIGN IN TO ASK"}
            </button>
          </form>
        </div>
        <div className="min-w-0">
          {questions.length === 0 ? (
            <p className="text-sm text-stone">No questions yet. Be the first to ask.</p>
          ) : (
            <div className="divide-y divide-line">
              {questions.map((item) => (
                <article key={item.id} className="py-5 first:pt-0">
                  <p className="text-sm font-medium text-bone">Q. {item.question}</p>
                  <p className="mt-2 text-[11px] text-stone">
                    {item.authorName} ·{" "}
                    {new Intl.DateTimeFormat("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }).format(new Date(item.createdAt))}
                  </p>
                  {item.answer && (
                    <div className="mt-4 border-l border-mango pl-4">
                      <p className="label-technical text-mango">MANGOSTA</p>
                      <p className="mt-1 text-sm leading-relaxed text-bone-dim">{item.answer}</p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
