import fs from "fs";
import path from "path";

export interface PersistentScoutState {
  token: string;
  scoutName: string;
  completedPages: number[];
  quizScore: number;
  referralScore: number;
  totalScore: number;
  hasPassedQuiz: boolean;
  hasRecruitedFriend: boolean;
  status: "In_Progress" | "Academic_Pass" | "Unlock_Volume_3";
  updatedAt: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "scouts.json");

function ensureStore(): Record<string, PersistentScoutState> {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    const initial: Record<string, PersistentScoutState> = {
      "CAPTAIN-RAY-700": {
        token: "CAPTAIN-RAY-700",
        scoutName: "Scout Explorer",
        completedPages: [],
        quizScore: 0,
        referralScore: 0,
        totalScore: 0,
        hasPassedQuiz: false,
        hasRecruitedFriend: false,
        status: "In_Progress",
        updatedAt: new Date().toISOString(),
      },
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveStore(data: Record<string, PersistentScoutState>) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

export function getOrCreateScout(token: string, name?: string): PersistentScoutState {
  const store = ensureStore();
  const cleanToken = token.trim() || "CAPTAIN-RAY-700";

  if (!store[cleanToken]) {
    store[cleanToken] = {
      token: cleanToken,
      scoutName: name || "Young Scout",
      completedPages: [],
      quizScore: 0,
      referralScore: 0,
      totalScore: 0,
      hasPassedQuiz: false,
      hasRecruitedFriend: false,
      status: "In_Progress",
      updatedAt: new Date().toISOString(),
    };
    saveStore(store);
  }
  return store[cleanToken];
}

export function updateScout(
  token: string,
  partial: Partial<PersistentScoutState>
): PersistentScoutState {
  const store = ensureStore();
  const scout = getOrCreateScout(token);

  const updated: PersistentScoutState = {
    ...scout,
    ...partial,
    updatedAt: new Date().toISOString(),
  };

  updated.totalScore = updated.quizScore + updated.referralScore;
  updated.hasPassedQuiz = updated.quizScore >= 400;
  updated.hasRecruitedFriend = updated.referralScore >= 300;

  if (updated.totalScore >= 700) {
    updated.status = "Unlock_Volume_3";
  } else if (updated.hasPassedQuiz) {
    updated.status = "Academic_Pass";
  } else {
    updated.status = "In_Progress";
  }

  store[scout.token] = updated;
  saveStore(store);
  return updated;
}
