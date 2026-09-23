"use client";

import React, { useState } from "react";
import { getQuizQuestionsForBook, QuizQuestion } from "@/lib/gamification";

interface ComprehensionQuizProps {
  /** Resolves to false when the score was not actually saved. */
  onSubmitAnswers: (
    answers: Record<string, number>,
    book: 1 | 2 | 3
  ) => void | Promise<boolean>;
  onReset: (book: 1 | 2 | 3) => void;
  currentQuizScore: number;
  bookNumber?: 1 | 2 | 3;
}

export default function ComprehensionQuiz({
  onSubmitAnswers,
  onReset,
  currentQuizScore,
  bookNumber = 2,
}: ComprehensionQuizProps) {
  const [activeBook, setActiveBook] = useState<1 | 2 | 3>(bookNumber);
  const questions = getQuizQuestionsForBook(activeBook);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState<boolean>(currentQuizScore === 400);

  const handleSelectOption = (questionId: string, optionIndex: number) => {
    if (submitted) return;
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionIndex,
    }));
  };

  // Grading is done server-side; the client only submits the raw answers.
  const handleSubmit = async () => {
    setSubmitted(true);
    const saved = await onSubmitAnswers(answers, activeBook);
    // A score that never reached the database must not leave the quiz locked
    // with the answers revealed — the child would be stuck on 0 points with no
    // way to try again.
    if (saved === false) setSubmitted(false);
  };

  const handleReset = () => {
    setAnswers({});
    setSubmitted(false);
    onReset(activeBook);
  };

  const handleSwitchBook = (b: 1 | 2 | 3) => {
    setActiveBook(b);
    setAnswers({});
    setSubmitted(false);
    onReset(b);
  };

  const allAnswered = questions.every((q) => answers[q.id] !== undefined);
  const isPerfect = currentQuizScore === 400;

  return (
    <div className="rounded-2xl border border-ink/10 bg-paper p-6 sm:p-8 shadow-card">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 pb-4">
        <div>
          <span className="eyebrow">Trilogy Mastery Engine</span>
          <h3 className="text-xl sm:text-2xl font-bold font-display text-ink">
            Book {activeBook} Mastery Quiz
          </h3>
        </div>
        <div className="flex gap-2">
          {([1, 2, 3] as const).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => handleSwitchBook(b)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                activeBook === b
                  ? "bg-spruce text-paper shadow-sm"
                  : "bg-paper-deep text-ink-soft hover:bg-ink/10"
              }`}
            >
              Book {b} Keys
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink/10 pb-4">
        <p className="text-sm text-ink-soft">
          Official committee-anchored questions. Each correct answer awards <strong>100 persistent points</strong> towards the 700-Point Biblical Gate.
        </p>
        <div className="rounded-xl bg-paper-deep px-4 py-2 text-right border border-ink/10">
          <span className="text-xs font-bold text-ink-soft uppercase tracking-wider block">Academic Points</span>
          <span className="text-2xl font-black font-display text-spruce">
            {currentQuizScore} / 400 pts
          </span>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {questions.map((q: QuizQuestion, qIdx: number) => {
          const selected = answers[q.id];
          const isCorrect = submitted && selected === q.correctIndex;

          return (
            <div
              key={q.id}
              className={`rounded-xl border p-5 transition ${
                submitted
                  ? isCorrect
                    ? "border-spruce/40 bg-spruce/5"
                    : "border-clay/40 bg-clay/5"
                  : "border-ink/10 bg-paper-deep/50 hover:border-ink/20"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-paper font-bold text-xs">
                  {qIdx + 1}
                </span>
                <div className="flex-1">
                  <h4 className="text-base font-bold text-ink sm:text-lg">
                    {q.question}
                  </h4>

                  <div className="mt-4 space-y-2.5">
                    {q.options.map((opt, optIdx) => {
                      const isOptionSelected = selected === optIdx;
                      let optionStyles = "border-ink/20 bg-paper text-ink hover:bg-paper-deep";

                      if (submitted) {
                        if (optIdx === q.correctIndex) {
                          optionStyles = "border-spruce bg-spruce/20 text-spruce-dark font-bold";
                        } else if (isOptionSelected) {
                          optionStyles = "border-clay bg-clay/20 text-clay-dark line-through";
                        } else {
                          optionStyles = "border-ink/10 opacity-50";
                        }
                      } else if (isOptionSelected) {
                        optionStyles = "border-spruce bg-spruce/10 text-spruce-dark font-bold shadow-sm ring-2 ring-spruce/30";
                      }

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          disabled={submitted}
                          onClick={() => handleSelectOption(q.id, optIdx)}
                          className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition flex items-center justify-between ${optionStyles}`}
                        >
                          <span>{opt}</span>
                          {submitted && optIdx === q.correctIndex && (
                            <span className="text-spruce font-bold text-sm">✓ 100 Pts</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-ink/10 pt-5">
        {!submitted ? (
          <button
            type="button"
            disabled={!allAnswered}
            onClick={handleSubmit}
            className="btn-primary w-full sm:w-auto"
          >
            Submit Quiz & Lock Academic Points (100 pts / question)
          </button>
        ) : (
          <div className="flex flex-wrap items-center justify-between w-full gap-3">
            <div className="text-sm font-semibold">
              {isPerfect ? (
                <span className="text-spruce flex items-center gap-1.5 font-bold">
                  🎉 Fantastic job! All 4 answers correct — 400 Academic Points locked!
                </span>
              ) : (
                <span className="text-clay flex items-center gap-1.5 font-bold">
                  ⚠️ You scored {currentQuizScore}/400 pts. Retake to secure full 400 points!
                </span>
              )}
            </div>
            {!isPerfect && (
              <button
                type="button"
                onClick={handleReset}
                className="btn-secondary text-sm py-2 px-4"
              >
                Retake Quiz
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
