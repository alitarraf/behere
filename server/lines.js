// M2 line pool — original lines written "in the spirit of" the four
// teachers. Nothing here is quoted from any book or talk; famous phrases
// were deliberately avoided. Grouped by flavor for maintenance only —
// the bell never reveals or records which spirit fired.
export const LINES = [
  // — in the spirit of Krishnamurti: looking without the word, no method
  'Can you look without naming what you see?',
  'The description is not the thing you are standing in.',
  'What you are running from is also a thought.',
  'Attention with no reason. Just this.',
  'The mind is replaying. Something else is listening.',
  'Is anything actually missing, or is that a thought?',
  'This moment has no opposite.',
  'Seeing is enough. Nothing needs to follow.',
  'The problem you were solving can wait. The sky cannot.',
  'No method reaches here. You are already here.',
  'What is true right now, before you answer?',
  'The image of your day is not the day.',

  // — in the spirit of Tolle: the Now, the inner body, the space
  'One breath, taken as if it mattered.',
  'The next moment never arrives. It is always this one.',
  'Feel your hands from the inside.',
  'The situation is now. The story is later.',
  'Thinking about your life is not living it.',
  'Whatever is happening, you are the space it happens in.',
  'Now is the only appointment you cannot miss.',
  'The mind says soon. The body says now.',
  'Stop rehearsing. The scene is already playing.',
  'There is a silence under this noise.',
  'What problem exists in this exact second?',
  'You are not your next thought.',

  // — in the spirit of Osho: aliveness, celebration, dropping seriousness
  'Alive, right now. Notice that first.',
  'Seriousness is a habit. This moment is not serious.',
  'Dance a little inside, where no one sees.',
  'Why rehearse? The flowers are not rehearsing.',
  'Existence is not waiting for you to finish.',
  'Laugh once, for no reason at all.',
  'You were breathing this whole time. Did you notice?',
  'Drop the plan for ten seconds. See what remains.',
  'This ordinary moment is the celebration.',
  'Wherever you were just going — it can wait.',
  'Be entirely in whatever this is.',
  'The mind is a beggar. This moment is the feast.',

  // — in the spirit of Ram Dass: the witness, arriving, no hurry
  'Here. Now. That was always the whole instruction.',
  'Come back from wherever the mind wandered. No blame.',
  'Awareness, briefly distracted — that is all this was.',
  'The quiet behind your thoughts has been waiting.',
  'Everyone you meet today is on the same walk.',
  'The witness sees even this.',
  'Nowhere to get to. You have already arrived.',
  'Let this moment be the teacher.',
  'The soul is not in a hurry.',
  'This too — even this — is part of it.',
  'Rest in the one who notices.',
  'You are not behind. There is no behind.',
];

export function pickLine(rand = Math.random) {
  return LINES[Math.floor(rand() * LINES.length)];
}
