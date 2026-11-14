// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import ComprehensionQuiz from "@/components/dashboard/ComprehensionQuiz";
import ScoreGate from "@/components/dashboard/ScoreGate";
import BookUnlockCard from "@/components/dashboard/BookUnlockCard";
import PageStickersGrid from "@/components/dashboard/PageStickersGrid";
import { getQuizQuestionsForBook } from "@/lib/gamification";

/**
 * Reward moments. Each one plays when the child earns it, on the thing that
 * changed, and stays still on a later visit (staging: the page celebrates what
 * just happened, not everything it finds every time it opens).
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <span role="img" aria-label={alt} data-src={src} />,
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const animated = (name: string) => container.querySelectorAll(`.animate-${name}`);
const click = async (el: Element) => {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
};
const buttonWith = (text: string) =>
  Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes(text)) as HTMLButtonElement;

describe("the quiz", () => {
  const questions = getQuizQuestionsForBook(2);

  it("pops each right answer and shakes a wrong pick when the child submits", async () => {
    act(() =>
      root.render(<ComprehensionQuiz onSubmitAnswers={async () => true} onReset={() => {}} currentQuizScore={0} />)
    );
    expect(container.querySelectorAll('[class*="animate-"]')).toHaveLength(0);

    // Every answer right except the first, which picks a wrong option.
    for (const [index, q] of questions.entries()) {
      const pick = index === 0 ? (q.correctIndex + 1) % q.options.length : q.correctIndex;
      await click(buttonWith(q.options[pick]));
    }
    await click(buttonWith("Submit Quiz"));

    expect(animated("pop-in")).toHaveLength(questions.length);
    expect(animated("shake")).toHaveLength(1);
    expect(animated("shake")[0].textContent).toContain(questions[0].options[(questions[0].correctIndex + 1) % questions[0].options.length]);
  });

  function answerAll(wrongFirst: boolean) {
    return (async () => {
      for (const [index, q] of questions.entries()) {
        const pick = wrongFirst && index === 0 ? (q.correctIndex + 1) % q.options.length : q.correctIndex;
        await click(buttonWith(q.options[pick]));
      }
      await click(buttonWith("Submit Quiz"));
    })();
  }

  it("celebrates a perfect score once the server has saved it", async () => {
    function Saved() {
      const [score, setScore] = useState(0);
      return (
        <ComprehensionQuiz
          onSubmitAnswers={async () => {
            setScore(400);
            return true;
          }}
          onReset={() => {}}
          currentQuizScore={score}
        />
      );
    }
    act(() => root.render(<Saved />));
    await answerAll(false);

    const banner = Array.from(animated("pop-in")).find((el) => el.textContent?.includes("Fantastic job"));
    expect(banner).toBeDefined();
    expect(banner!.querySelector('.animate-wiggle[aria-hidden="true"]')?.textContent).toBe("🎉");
    expect(animated("shake")).toHaveLength(0);
  });

  it("shows only a neutral check while the save is on its way: no score, no retake, no motion", async () => {
    act(() =>
      root.render(<ComprehensionQuiz onSubmitAnswers={() => new Promise(() => {})} onReset={() => {}} currentQuizScore={0} />)
    );
    await answerAll(true);

    expect(container.textContent).toContain("Checking your answers");
    expect(container.textContent).not.toContain("You scored");
    expect(buttonWith("Retake Quiz")).toBeUndefined();
    expect(container.querySelectorAll('[class*="animate-"]:not(.animate-spin)')).toHaveLength(0);
  });

  it("drops every celebration when the save fails, and lets the child submit again", async () => {
    act(() => root.render(<ComprehensionQuiz onSubmitAnswers={async () => false} onReset={() => {}} currentQuizScore={0} />));
    await answerAll(false);

    expect(container.querySelectorAll('[class*="animate-"]')).toHaveLength(0);
    expect(buttonWith("Submit Quiz")).toBeDefined();
  });

  it("treats a save that throws like one that failed, instead of checking forever", async () => {
    act(() =>
      root.render(
        <ComprehensionQuiz onSubmitAnswers={() => Promise.reject(new Error("offline"))} onReset={() => {}} currentQuizScore={0} />
      )
    );
    await answerAll(false);

    expect(container.textContent).not.toContain("Checking your answers");
    expect(buttonWith("Submit Quiz")).toBeDefined();
  });

  it("locks the book tabs while a save is on its way", async () => {
    act(() =>
      root.render(<ComprehensionQuiz onSubmitAnswers={() => new Promise(() => {})} onReset={() => {}} currentQuizScore={0} />)
    );
    await answerAll(false);
    expect(buttonWith("Book 1 Keys").disabled).toBe(true);
  });

  it("stays still when it opens on a quiz finished on an earlier visit", () => {
    act(() =>
      root.render(<ComprehensionQuiz onSubmitAnswers={async () => true} onReset={() => {}} currentQuizScore={400} />)
    );
    expect(container.querySelectorAll('[class*="animate-"]')).toHaveLength(0);
  });
});

describe("the score gate", () => {
  function Gate({ quizScore, referralScore = 0 }: { quizScore: number; referralScore?: number }) {
    return (
      <ScoreGate
        totalScore={quizScore + referralScore}
        quizScore={quizScore}
        referralScore={referralScore}
        scoutName="Sam"
      />
    );
  }

  it("leaves the fanfare to the unlock card when the same answer also unlocks Book 2", () => {
    act(() => root.render(<Gate quizScore={0} referralScore={300} />));
    act(() => root.render(<Gate quizScore={400} referralScore={300} />));
    expect(container.querySelectorAll('[class*="animate-"]')).toHaveLength(0);
  });

  it("bounces the medal when the quiz pass lands", () => {
    act(() => root.render(<Gate quizScore={0} />));
    act(() => root.render(<Gate quizScore={400} />));
    expect(animated("boing")).toHaveLength(1);
    expect(animated("boing")[0].textContent).toContain("🎖️");
  });

  it("does not bounce a pass that was already there", () => {
    act(() => root.render(<Gate quizScore={400} />));
    expect(animated("boing")).toHaveLength(0);
    expect(animated("rise")).toHaveLength(0);
  });
});

describe("the unlock card", () => {
  it("stamps the badge and pops the heading only when told the unlock just happened", () => {
    act(() => root.render(<BookUnlockCard scoutName="Sam" bookNumber={2} celebrate />));
    expect(animated("stamp")).toHaveLength(1);
    expect(animated("pop-in")[0].textContent).toContain("Book 2 Unlocked");

    act(() => root.render(<BookUnlockCard scoutName="Sam" bookNumber={3} />));
    expect(animated("stamp")).toHaveLength(0);
    expect(animated("pop-in")).toHaveLength(0);
  });

  it("keeps an empty status region ready, so the dispatch news is announced when it lands", () => {
    act(() => root.render(<BookUnlockCard scoutName="Sam" bookNumber={2} />));
    const status = container.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status!.textContent).toBe("");
  });
});

describe("the sticker grid", () => {
  function Grid({ start }: { start: number[] }) {
    const [done, setDone] = useState(start);
    return (
      <PageStickersGrid
        completedPages={done}
        onTogglePage={(n) => setDone((d) => (d.includes(n) ? d.filter((p) => p !== n) : [...d, n]))}
      />
    );
  }

  it("stamps only the badge the child just ticked", async () => {
    act(() => root.render(<Grid start={[1]} />));
    expect(animated("stamp")).toHaveLength(0);

    await click(buttonWith("page 2,"));
    expect(animated("stamp")).toHaveLength(1);
    expect(buttonWith("page 2,").getAttribute("aria-pressed")).toBe("true");
  });

  it("moves the stamp to whichever badge was ticked last, and stamps a re-tick again", async () => {
    act(() => root.render(<Grid start={[]} />));
    const stamped = () =>
      Array.from(animated("stamp")).map((el) => el.closest("div.group")?.querySelector("button")?.textContent);

    await click(buttonWith("page 2,"));
    await click(buttonWith("page 3,"));
    expect(stamped()).toHaveLength(1);
    expect(stamped()[0]).toContain("page 3,");

    await click(buttonWith("page 3,"));
    expect(stamped()).toHaveLength(0);
    await click(buttonWith("page 3,"));
    expect(stamped()[0]).toContain("page 3,");
  });

  it("does not stamp a badge being taken back off", async () => {
    act(() => root.render(<Grid start={[1]} />));
    await click(buttonWith("page 1,"));
    expect(animated("stamp")).toHaveLength(0);
  });
});
