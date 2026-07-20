// M1 starter pool — original lines, written "in the spirit of"
// Krishnamurti / Tolle / Osho / Ram Dass. Never verbatim from any text.
// Replaced/expanded in M2 by a dedicated writing session.
export const LINES = [
  'Where are you right now?',
  'This moment is not on the way to another one.',
  'Notice the one who is noticing.',
  'The thought about now is not now.',
  'Nothing needs to happen next.',
  'Come back. That is all.',
  'There is no later in which to be here.',
  'You are not the story right now.',
  'What is here when you stop looking for something?',
  'Listen — not to anything in particular.',
  'This is not a rehearsal.',
  'The mind is elsewhere. You are not.',
];

export function pickLine(rand = Math.random) {
  return LINES[Math.floor(rand() * LINES.length)];
}
