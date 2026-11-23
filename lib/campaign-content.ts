import { CHARACTER_NAMES, type Character } from "@/lib/campaign";

// Ray's approved responses, with long dashes replaced by commas to match house style.
export const CHARACTER_MESSAGES: Record<Character, string> = {
  gideon: "Cap tip and a huge high-five from Gideon! He pushed back the brim of his explorer cap when he saw your vote on the Neighborhood Watch board. Whether we're facing giant problems or exploring Elm Street, Gideon says having a brave teammate like your child makes every adventure twice as strong!",
  sunny: "Big smiles and a joyful cheer from Sunny! She opened her trusty guidebook the second your vote came in and wrote your family's name right on the front page. Sunny says she can't wait to sing, learn, and discover God's wisdom together with your child!",
  barnabas: "Gears turning and glasses gleaming, Barnabas says thank you! He pushed up his slipping glasses in excitement when he saw your vote on the Neighborhood Watch board. Barnabas says two creative minds are always better than one, and he's ready to build amazing solutions with your child!",
  lucy: "Pencil poised and a big cheer from Lucy! She wrote your child's vote in big, neat letters right at the top of her official Neighborhood Watch notepad. Lucy says every great team needs a careful thinker who pays attention to the details, and she's thrilled your child picked her!",
  willie: "A sturdy thumbs-up and a big grin from Willie! He set down his garden trowel the moment he saw your vote pop up on the Neighborhood Watch board. Willie says hard work and never giving up are way more fun when you have a dependable friend like your child on the crew!",
};
export const CHARACTER_DESCRIPTIONS: Record<Character, string> = {
  gideon: "The Brave Leader who stands up for what's right",
  sunny: "The Encouraging Guide who helps us make wise choices",
  barnabas: "The Clever Inventor who builds creative solutions",
  lucy: "The Careful Planner who keeps track of every detail",
  willie: "The Hardworking Builder who never gives up",
};
export const VOTE_QUESTION = "Which character from The Neighborhood Chronicles would you want on your team, and what big adventure or challenge would you ask them to help you solve?";
export function optionalQuestion(character: Character | ""): string {
  return `What would you and ${character ? CHARACTER_NAMES[character] : "your chosen character"} do together?`;
}
export function thankYouTitle(firstName: string, character: Character): string {
  return `Woohoo, ${firstName}! ${CHARACTER_NAMES[character]} says thank you!`;
}
