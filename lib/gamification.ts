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

export const BOOK2_GATE_CONFIG = {
  headerBanner: "BECOME A QUEST CAPTAIN! UPGRADE YOUR SCORE TO THE BIBLICAL 700!",
  mainPanelCopy:
    "Fantastic job, Scout! You aced your Book 2 Mastery Quiz and locked in your 400 Academic Points. Your digital coloring ribbon is officially ready to print! But to keep your legacy path alive for Book 3, you must recruit 1 friend to join the circle.",
  academicPassThreshold: 400,
  friendReferralPoints: 300,
  unlockThreshold: 700,
  pointsPerQuestion: 100,
};

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
