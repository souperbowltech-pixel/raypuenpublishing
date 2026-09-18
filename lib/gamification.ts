export interface QuizQuestion {
  id: string;
  bookNumber: 1 | 2 | 3;
  questionNumber: number;
  question: string;
  correctAnswer: string;
  incorrectAnswers: string[];
  options: string[];
  correctIndex: number;
}

export interface ScoutState {
  scoutName: string;
  bookScores: {
    1: number;
    2: number;
    3: number;
  };
  hasRecruitedFriend: boolean;
  referralCode: string;
}

/**
 * Referral gate (Ray's directive #2): the 3-pack invite form captures 3 friend
 * names, but the 300 referral points fire the moment ANY 2 of those 3 invited
 * friends log in and turn their Page 1 sticker from grayscale to full colour.
 */
export const REFERRAL_INVITE_CAPACITY = 3; // names captured at checkout
export const REFERRAL_FRIEND_REQUIREMENT = 2; // friends needed to fire the points

export const BOOK2_GATE_CONFIG = {
  headerBanner: "BECOME A QUEST CAPTAIN! UPGRADE YOUR SCORE TO THE BIBLICAL 700!",
  mainPanelCopy:
    "Fantastic job, Scout! You read Book 1, aced your comprehension quiz, and locked in your 400 Academic Points. Your digital coloring ribbon is officially ready to print! To reach the Biblical 700 and unlock Book 2 completely free, you must recruit 2 friends to join the circle.",
  academicPassThreshold: 400,
  friendReferralPoints: 300,
  friendReferralRequirement: REFERRAL_FRIEND_REQUIREMENT,
  friendInviteCapacity: REFERRAL_INVITE_CAPACITY,
  unlockThreshold: 700,
  pointsPerQuestion: 100,
};

/**
 * The $40 "Grandpa multiplier" (Ray's directive #6): a relative or family friend
 * can sponsor a child for a flat $40, which leap-frogs the peer track and unlocks
 * Book 3 free — independently of the 700-point Book 2 path.
 */
export const GRANDPA_SPONSOR_PRICE = 40.0;

/**
 * Rule 2 (Book 2 Continuation Hook): when a profile advances to Book 2 without an
 * adult relative contribution, a persistent encouraging banner is shown at the top
 * of the dashboard. This is Ray's exact approved copy.
 */
export const BOOK2_CONTINUATION_BANNER =
  "Hey Scout! Show your favorite completed Book 1 coloring pages to a grandfather, relative, or family friend today! Their support via your secret dashboard link will instantly pre-approve and unlock Book 3 for you early!";

/** Total interactive sticker slots (one per child-facing virtue page of Book 1). */
export const STICKER_SLOT_COUNT = 19;

/**
 * Path to a slot's full-colour merit-badge PNG. Illustrator assets drop into
 * `public/stickers/` as slot-01.png … slot-19.png (delivered in the
 * `Geezy_Goober_V1_Stickers_Final` ZIP). Until a file exists the UI falls back
 * to a numbered placeholder, so badges can be added sequentially.
 */
export function stickerBadgePath(slot: number): string {
  return `/stickers/slot-${String(slot).padStart(2, "0")}.png`;
}

export const TRILOGY_QUIZ_DATA: Record<1 | 2 | 3, Array<{ question: string; correct: string; incorrect: string[] }>> = {
  1: [
    {
      question: "What happened to the Geezy Goober’s words at the very start of our story?",
      correct: "They were trapped inside a tight burlap sack!",
      incorrect: [
        "They flew away into a big storm cloud.",
        "He forgot them because he took a long nap.",
      ],
    },
    {
      question: "Where did the characters have to go to find the curmudgeonly Grumble-Grip bird?",
      correct: "To the very top of a hidden green mountain underwater.",
      incorrect: [
        "Inside a dark cave behind the pink jelly shoreline.",
        "High up in a hollow tree trunk in the forest.",
      ],
    },
    {
      question: "What did the grumpy Grumble-Grip demand before he would return the gold fountain pen?",
      correct: "He wanted his feathers painted beautiful blue and bright tan.",
      incorrect: [
        "He wanted a giant basket of delicious red jelly donuts.",
        "He wanted a musical sea-shell to play him a bedtime song.",
      ],
    },
    {
      question: "Who flew down from the high, cold mountains to save the day with her magical gold dust?",
      correct: "The beautiful Sunny Fairy wearing a golden crown.",
      incorrect: [
        "A friendly sea turtle with a big cheerful grin.",
        "Barnaby Bingle the Bear wearing his safety goggles.",
      ],
    },
  ],
  2: [
    {
      question: "What did the beautiful blue lake turn into overnight that made the Wiggly Wump pout?",
      correct: "A thick, sticky sea of pink bubble-glue!",
      incorrect: [
        "A freezing mountain of bright white ice.",
        "A bubbling pool of hot purple lava.",
      ],
    },
    {
      question: "Why did Barnaby Bingle the Bear say he couldn't build his magnificent ship all by himself?",
      correct: "Because he possessed deep humility and knew he needed an active crew.",
      incorrect: [
        "Because his shiny brass hammer was completely broken.",
        "Because he lost his wild blueprint map on the beach.",
      ],
    },
    {
      question: "What everyday household items did our creative heroes use to sew the hull of the submarine?",
      correct: "Giant clothing buttons and thick string threads.",
      incorrect: [
        "Shiny silver kitchen spoons and copper wire.",
        "Old metal tin cans and curling green tree bark.",
      ],
    },
    {
      question: "How did the Whistling Sea-Shell persuade the giant orange octopus to give up the wooden key?",
      correct: "It blew a beautiful, joyful musical chord that made him laugh out loud.",
      incorrect: [
        "It tickled his long orange tentacles until he dropped it.",
        "It traded him a pouch of glowing green jelly seeds.",
      ],
    },
  ],
  3: [
    {
      question: "Where were the rare blue and tan paint-rocks hidden inside the lake?",
      correct: "Deep down inside a sea-sheller's den on a hidden underwater mountain.",
      incorrect: [
        "Locked inside a heavy iron chest on the sandy pink beach.",
        "Hidden right under the Wiggly Wump's favorite beach chair.",
      ],
    },
    {
      question: "Who was guarding the bright paint-rocks on his throne made of stone?",
      correct: "A giant green Tickle-Squid with a mustache of lace.",
      incorrect: [
        "Two grumpy sea turtles with cheerful grins.",
        "A friendly little cartoon fish with goo on its nose.",
      ],
    },
    {
      question: "How did our heroes make the big green Tickle-Squid roll on his back and laugh?",
      correct: "The Whistling Shell blew a magnificent tune while the Wump danced.",
      incorrect: [
        "The Geezy Goober tickled his tentacles with a paint brush.",
        "They gave him a delicious box of sweet red jelly donuts.",
      ],
    },
    {
      question: "What happens the exact moment the paint-rocks are delivered to the Grumble-Grip bird?",
      correct: "He lets all the words of the Goober go completely free!",
      incorrect: [
        "He flies away into the high, cold mountains with the gold pen.",
        "He turns into a completely different animal with purple bubbles.",
      ],
    },
  ],
};

export function getQuizQuestionsForBook(bookNum: 1 | 2 | 3): QuizQuestion[] {
  return TRILOGY_QUIZ_DATA[bookNum].map((item, idx) => {
    const correctPlacement = idx % 3;
    const options = [...item.incorrect];
    options.splice(correctPlacement, 0, item.correct);

    return {
      id: `book${bookNum}_q${idx + 1}`,
      bookNumber: bookNum,
      questionNumber: idx + 1,
      question: item.question,
      correctAnswer: item.correct,
      incorrectAnswers: item.incorrect,
      options,
      correctIndex: correctPlacement,
    };
  });
}

/**
 * Server-side quiz grading. The client submits raw answers (a map of
 * questionId -> chosen option index) and the score is computed here so it can
 * never be forged. Clamped to [0, academicPassThreshold].
 */
export function gradeQuiz(bookNum: 1 | 2 | 3, answers: Record<string, number>): number {
  const questions = getQuizQuestionsForBook(bookNum);
  let score = 0;
  for (const q of questions) {
    if (answers && answers[q.id] === q.correctIndex) {
      score += BOOK2_GATE_CONFIG.pointsPerQuestion;
    }
  }
  return Math.max(0, Math.min(BOOK2_GATE_CONFIG.academicPassThreshold, score));
}
