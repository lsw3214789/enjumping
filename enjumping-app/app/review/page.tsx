"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Example {
  scene: string;
  en: string;
  zh: string;
}

interface ReviewCard {
  id: string;
  word: string;
  ipa: string | null;
  pos: string | null;
  translation: string;
  examples: Example[] | null;
}

type CardMode = "flashcard" | "cloze";

interface ClozeData {
  blanked: string;
  matched: string;
}

interface ClozeResult {
  correct: boolean;
  matched: string;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildCloze(word: string, sentence: string): ClozeData | null {
  const re = new RegExp(`\\b(${escapeRegex(word)}\\w*)\\b`, "i");
  const m = sentence.match(re);
  if (!m) return null;
  return { blanked: sentence.replace(re, "______"), matched: m[0] };
}

function checkAnswer(word: string, input: string): boolean {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return false;
  return new RegExp(`^${escapeRegex(word.toLowerCase())}\\w*$`).test(normalized);
}

function canBeCloze(card: ReviewCard): boolean {
  const en = card.examples?.[0]?.en;
  if (!en) return false;
  return buildCloze(card.word, en) !== null;
}

// ── rating buttons ────────────────────────────────────────────────────────────

const RATINGS = [
  {
    value: 1 as const,
    en: "Again",
    zh: "忘記",
    className:
      "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900",
  },
  {
    value: 2 as const,
    en: "Hard",
    zh: "勉強",
    className:
      "bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:hover:bg-orange-900",
  },
  {
    value: 3 as const,
    en: "Good",
    zh: "順",
    className:
      "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900",
  },
  {
    value: 4 as const,
    en: "Easy",
    zh: "太簡單",
    className:
      "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-950 dark:text-green-300 dark:hover:bg-green-900",
  },
];

// ── component ─────────────────────────────────────────────────────────────────

export default function ReviewPage() {
  // snapshot — fetched once, never re-fetched
  const [cards, setCards] = useState<ReviewCard[]>([]);
  const [cardModes, setCardModes] = useState<CardMode[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // flashcard phase
  const [showAnswer, setShowAnswer] = useState(false);

  // cloze phase
  const [clozeData, setClozeData] = useState<ClozeData | null>(null);
  const [userAnswer, setUserAnswer] = useState("");
  const [clozeResult, setClozeResult] = useState<ClozeResult | null>(null);

  // shared
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [bgError, setBgError] = useState(false); // non-blocking toast

  const cardShownAt = useRef<number>(Date.now());
  // Prevents firing the same card's API twice (double-click before re-render)
  const actionFiredRef = useRef(false);
  const bgErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── fetch due cards once ──────────────────────────────────────────────────
  useEffect(() => {
    async function fetchDueCards() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("words")
        .select("id, word, ipa, pos, translation, examples")
        .lte("due", new Date().toISOString())
        .order("due", { ascending: true });

      if (error) {
        setFetchError(error.message);
      } else {
        const fetched = data ?? [];
        const modes: CardMode[] = fetched.map((card) =>
          canBeCloze(card) && Math.random() < 0.5 ? "cloze" : "flashcard"
        );
        setCards(fetched);
        setCardModes(modes);
        cardShownAt.current = Date.now();
      }
      setLoading(false);
    }
    fetchDueCards();
  }, []);

  // ── reset all card state when index advances ──────────────────────────────
  useEffect(() => {
    if (cards.length === 0 || currentIndex >= cards.length) return;

    setShowAnswer(false);
    setUserAnswer("");
    setClozeResult(null);
    actionFiredRef.current = false; // allow next card to be rated
    cardShownAt.current = Date.now();

    if (cardModes[currentIndex] === "cloze") {
      const card = cards[currentIndex];
      setClozeData(buildCloze(card.word, card.examples![0].en)!);
    } else {
      setClozeData(null);
    }
  }, [currentIndex, cards, cardModes]);

  // ── background sync ───────────────────────────────────────────────────────
  function postReview(payload: Record<string, unknown>) {
    fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (!res.ok) {
          console.error("review sync failed:", res.status);
          triggerBgError();
        }
      })
      .catch((err) => {
        console.error("review sync error:", err);
        triggerBgError();
      });
  }

  function triggerBgError() {
    setBgError(true);
    if (bgErrorTimer.current) clearTimeout(bgErrorTimer.current);
    bgErrorTimer.current = setTimeout(() => setBgError(false), 3000);
  }

  // ── handlers ──────────────────────────────────────────────────────────────
  function handleShowAnswer() {
    setShowAnswer(true);
  }

  function handleRate(rating: 1 | 2 | 3 | 4) {
    if (actionFiredRef.current) return;
    actionFiredRef.current = true;

    // Capture current card data NOW, before index advances
    const card = cards[currentIndex];
    const durationMs = Date.now() - cardShownAt.current;

    // Advance UI immediately — no await
    setCurrentIndex((i) => i + 1);

    // Sync to server in background
    postReview({
      wordId: card.id,
      rating,
      reviewType: "flashcard",
      isCorrect: null,
      userAnswer: null,
      durationMs,
    });
  }

  function handleClozeSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (actionFiredRef.current || clozeResult !== null || !userAnswer.trim()) return;
    actionFiredRef.current = true;

    // Capture before updating state
    const card = cards[currentIndex];
    const durationMs = Date.now() - cardShownAt.current;
    const correct = checkAnswer(card.word, userAnswer);
    const matched = clozeData!.matched;

    // Show result immediately — no await
    setClozeResult({ correct, matched });

    // Sync to server in background
    postReview({
      wordId: card.id,
      rating: correct ? 3 : 1,
      reviewType: "cloze",
      isCorrect: correct,
      userAnswer,
      durationMs,
    });
  }

  function handleNext() {
    setCurrentIndex((i) => i + 1);
  }

  // ── screens ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-400 text-sm">載入中...</p>
      </main>
    );
  }

  if (fetchError || cards.length === 0) {
    return (
      <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-3xl mb-3">🎉</p>
          <p className="text-zinc-700 dark:text-zinc-300 font-medium mb-1">
            {fetchError ? "載入失敗" : "今天沒有要複習的卡片"}
          </p>
          <p className="text-sm text-zinc-400 mb-6">
            {fetchError ?? "所有單字都已複習完畢！"}
          </p>
          <Link
            href="/"
            className="text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
          >
            回首頁
          </Link>
        </div>
      </main>
    );
  }

  if (currentIndex >= cards.length) {
    return (
      <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-3xl mb-3">🎉</p>
          <p className="text-zinc-700 dark:text-zinc-300 font-medium mb-1">
            複習完成！
          </p>
          <p className="text-sm text-zinc-400 mb-6">
            共完成 {cards.length} 張卡片
          </p>
          <Link
            href="/"
            className="text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
          >
            回首頁
          </Link>
        </div>
      </main>
    );
  }

  const card = cards[currentIndex];
  const mode = cardModes[currentIndex];

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-lg mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/"
            className="text-sm text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
          >
            ← 回首頁
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-zinc-300 dark:text-zinc-600 uppercase tracking-wide">
              {mode === "cloze" ? "填空" : "翻卡"}
            </span>
            <span className="text-sm text-zinc-400">
              {currentIndex + 1} / {cards.length}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full mb-8">
          <div
            className="h-1 bg-zinc-500 dark:bg-zinc-400 rounded-full transition-all duration-300"
            style={{ width: `${(currentIndex / cards.length) * 100}%` }}
          />
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 mb-5 min-h-[220px] flex flex-col justify-center">
          {mode === "flashcard" ? (
            <>
              <div className="text-center">
                <p className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 mb-2 tracking-tight">
                  {card.word}
                </p>
                {card.ipa && (
                  <p className="text-zinc-400 text-base">{card.ipa}</p>
                )}
              </div>

              {showAnswer && (
                <div className="border-t border-zinc-100 dark:border-zinc-800 mt-6 pt-6 space-y-4">
                  <div className="text-center">
                    {card.pos && (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-medium px-2.5 py-0.5 mb-2">
                        {card.pos}
                      </span>
                    )}
                    <p className="text-xl text-zinc-700 dark:text-zinc-300 font-medium">
                      {card.translation}
                    </p>
                  </div>
                  {card.examples?.[0] && (
                    <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800 px-4 py-3">
                      <p className="text-sm text-zinc-700 dark:text-zinc-200 leading-relaxed">
                        {card.examples[0].en}
                      </p>
                      <p className="text-xs text-zinc-400 mt-1">
                        {card.examples[0].zh}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              {clozeData && (
                <>
                  <p className="text-lg text-zinc-800 dark:text-zinc-100 leading-relaxed">
                    {clozeData.blanked}
                  </p>
                  <p className="text-xs text-zinc-400">{card.examples![0].zh}</p>

                  {clozeResult === null ? (
                    <form onSubmit={handleClozeSubmit} className="flex gap-2 pt-1">
                      <Input
                        value={userAnswer}
                        onChange={(e) => setUserAnswer(e.target.value)}
                        placeholder="輸入答案…"
                        autoFocus
                        className="flex-1"
                      />
                      <Button type="submit" disabled={!userAnswer.trim()}>
                        送出
                      </Button>
                    </form>
                  ) : (
                    <div
                      className={`rounded-lg px-4 py-3 text-sm font-medium ${
                        clozeResult.correct
                          ? "bg-green-50 border border-green-200 text-green-700 dark:bg-green-950 dark:border-green-800 dark:text-green-300"
                          : "bg-red-50 border border-red-200 text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-300"
                      }`}
                    >
                      {clozeResult.correct ? (
                        <>
                          答對 ✓{" "}
                          <span className="font-bold">{clozeResult.matched}</span>
                        </>
                      ) : (
                        <>
                          答錯 ✗ 正確答案：
                          <span className="font-bold">{clozeResult.matched}</span>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        {mode === "flashcard" ? (
          !showAnswer ? (
            <Button className="w-full" onClick={handleShowAnswer}>
              顯示答案
            </Button>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {RATINGS.map(({ value, en, zh, className }) => (
                <button
                  key={value}
                  onClick={() => handleRate(value)}
                  className={`rounded-xl px-2 py-3 text-sm font-medium transition-colors ${className}`}
                >
                  <span className="block text-[10px] opacity-60 mb-0.5">{en}</span>
                  {zh}
                </button>
              ))}
            </div>
          )
        ) : (
          clozeResult !== null && (
            <Button className="w-full" onClick={handleNext}>
              下一張
            </Button>
          )
        )}
      </div>

      {/* Background sync error toast — fixed, non-blocking */}
      {bgError && (
        <div className="fixed bottom-4 right-4 bg-zinc-800 text-zinc-200 text-xs px-3 py-2 rounded-lg shadow-lg pointer-events-none">
          上一筆同步失敗
        </div>
      )}
    </main>
  );
}
