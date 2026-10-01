import { describe, it, expect } from "vitest";
import {
  gradeQuiz,
  getQuizQuestionsForBook,
  getMainPanelCopy,
  getUnlockedPanelCopy,
  stickerBadgePath,
  BOOK2_GATE_CONFIG,
  TRILOGY_QUIZ_DATA,
} from "./gamification";

describe("gradeQuiz (server-side comprehension grading)", () => {
  it("awards full academic points (400) for all correct answers on Book 1", () => {
    const questions = getQuizQuestionsForBook(1);
    const answers: Record<string, number> = {};
    for (const q of questions) {
      answers[q.id] = q.correctIndex;
    }

    const score = gradeQuiz(1, answers);
    expect(score).toBe(BOOK2_GATE_CONFIG.academicPassThreshold);
    expect(score).toBe(400);
  });

  it("awards full academic points (400) for all correct answers on Book 2 and Book 3", () => {
    for (const bookNum of [2, 3] as const) {
      const questions = getQuizQuestionsForBook(bookNum);
      const answers: Record<string, number> = {};
      for (const q of questions) {
        answers[q.id] = q.correctIndex;
      }

      const score = gradeQuiz(bookNum, answers);
      expect(score).toBe(400);
    }
  });

  it("awards partial scores per correct question (100 pts each)", () => {
    const questions = getQuizQuestionsForBook(1);

    // 1 correct answer (100 pts)
    const oneCorrect = { [questions[0].id]: questions[0].correctIndex };
    expect(gradeQuiz(1, oneCorrect)).toBe(100);

    // 2 correct answers (200 pts)
    const twoCorrect = {
      [questions[0].id]: questions[0].correctIndex,
      [questions[1].id]: questions[1].correctIndex,
    };
    expect(gradeQuiz(1, twoCorrect)).toBe(200);

    // 3 correct answers (300 pts)
    const threeCorrect = {
      [questions[0].id]: questions[0].correctIndex,
      [questions[1].id]: questions[1].correctIndex,
      [questions[2].id]: questions[2].correctIndex,
    };
    expect(gradeQuiz(1, threeCorrect)).toBe(300);
  });

  it("awards 0 points when answers are incorrect", () => {
    const questions = getQuizQuestionsForBook(1);
    const incorrectAnswers: Record<string, number> = {};
    for (const q of questions) {
      // Pick an index different from correctIndex (0, 1, or 2)
      incorrectAnswers[q.id] = (q.correctIndex + 1) % 3;
    }

    expect(gradeQuiz(1, incorrectAnswers)).toBe(0);
  });

  it("safely handles empty, missing, or irrelevant answers", () => {
    expect(gradeQuiz(1, {})).toBe(0);
    expect(gradeQuiz(1, null as unknown as Record<string, number>)).toBe(0);
    expect(gradeQuiz(1, undefined as unknown as Record<string, number>)).toBe(0);
    expect(gradeQuiz(1, { bogus_question_id: 0 })).toBe(0);
  });

  it("never exceeds academicPassThreshold or drops below 0", () => {
    const questions = getQuizQuestionsForBook(1);
    const answers: Record<string, number> = {};
    for (const q of questions) {
      answers[q.id] = q.correctIndex;
    }

    const score = gradeQuiz(1, answers);
    expect(score).toBeLessThanOrEqual(BOOK2_GATE_CONFIG.academicPassThreshold);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});

describe("getQuizQuestionsForBook (question structure and option placement)", () => {
  it("structures all trilogy book questions with deterministic option shuffling", () => {
    for (const bookNum of [1, 2, 3] as const) {
      const rawData = TRILOGY_QUIZ_DATA[bookNum];
      const questions = getQuizQuestionsForBook(bookNum);

      expect(questions.length).toBe(rawData.length);
      expect(questions.length).toBe(4);

      for (let idx = 0; idx < questions.length; idx++) {
        const q = questions[idx];
        expect(q.id).toBe(`book${bookNum}_q${idx + 1}`);
        expect(q.bookNumber).toBe(bookNum);
        expect(q.questionNumber).toBe(idx + 1);
        expect(q.options.length).toBe(3);
        // Correct answer is placed at q.correctIndex
        expect(q.options[q.correctIndex]).toBe(q.correctAnswer);
        expect(q.correctIndex).toBe(idx % 3);
        // Options contain all incorrect answers plus the correct one
        expect(q.options).toContain(rawData[idx].correct);
        for (const inc of rawData[idx].incorrect) {
          expect(q.options).toContain(inc);
        }
      }
    }
  });
});

describe("gamification copy and asset formatting", () => {
  it("formats Chief Explorer name in main and unlocked panel copy", () => {
    expect(getMainPanelCopy("Ray")).toContain("Chief Explorer Ray!");
    expect(getMainPanelCopy("")).toContain("Chief Explorer!");
    expect(getMainPanelCopy()).toContain("Chief Explorer!");

    expect(getUnlockedPanelCopy("Ray")).toContain("Chief Explorer Ray!");
    expect(getUnlockedPanelCopy("")).toContain("Chief Explorer!");
    expect(getUnlockedPanelCopy()).toContain("Chief Explorer!");
  });

  it("formats sticker badge paths with zero-padded two-digit slots", () => {
    expect(stickerBadgePath(1)).toBe("/stickers/slot-01.png");
    expect(stickerBadgePath(9)).toBe("/stickers/slot-09.png");
    expect(stickerBadgePath(10)).toBe("/stickers/slot-10.png");
    expect(stickerBadgePath(19)).toBe("/stickers/slot-19.png");
  });
});
