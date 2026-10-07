"use client";

import { useEffect, useState } from "react";
type ProductQuestion = { id: string; productId: string; userId: string; authorName: string; question: string; answer?: string; answeredAt?: string; createdAt: string };

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<ProductQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const load = () => fetch("/api/admin/product-questions", { cache: "no-store" }).then((r) => r.json()).then((d) => setQuestions(d.questions || []));
  useEffect(() => { void load(); }, []);
  const answer = async (id: string) => { const value = answers[id]?.trim(); if (!value) return; await fetch("/api/admin/product-questions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, answer: value }) }); setAnswers((a) => ({ ...a, [id]: "" })); await load(); };
  return <div><p className="label-technical mb-3">PRODUCT TRUST</p><h1 className="font-display text-4xl tracking-tight">PRODUCT QUESTIONS</h1><div className="mt-8 space-y-4">{questions.map((item) => <article key={item.id} className="border border-line bg-charcoal p-5"><p className="font-mono text-[10px] text-stone">{item.productId} · {item.authorName}</p><h2 className="mt-2 text-sm font-medium">Q: {item.question}</h2>{item.answer ? <p className="mt-4 border-l border-mango pl-3 text-sm text-bone-dim">A: {item.answer}</p> : <div className="mt-4 flex gap-2"><input value={answers[item.id] || ""} onChange={(e) => setAnswers((a) => ({ ...a, [item.id]: e.target.value }))} className="min-w-0 flex-1 border border-line-strong bg-void px-3 py-2 text-xs" placeholder="Write the official answer…" /><button onClick={() => void answer(item.id)} className="border border-line-strong px-4 py-2 text-xs hover:border-bone">ANSWER</button></div>}</article>)}</div></div>;
}
