const concepts = (lessonId, lessonTitle) => [
  { id: `${lessonId}-explore`, title: `Explore ${lessonTitle}`, icon: '✦', description: 'An immersive learning adventure', vrPath: `/vr/${lessonId}/concept-1/` },
  { id: `${lessonId}-discover`, title: `${lessonTitle} Discovery`, icon: '◈', description: 'Learn by looking, listening and doing', vrPath: `/vr/${lessonId}/concept-2/` }
];

const lesson = (id, title) => ({ id, title, concepts: concepts(id, title) });
const term = (id, lessons) => ({ id, title: `Term ${id}`, lessons });
const subject = (id, icon, accent, terms) => ({ id, title: id, icon, accent, terms });

const template = {
  English: [term(1, [lesson('story-world', 'Story World'), lesson('word-wonders', 'Word Wonders'), lesson('speak-and-shine', 'Speak and Shine')]), term(2, [lesson('reading-rainbow', 'Reading Rainbow'), lesson('language-lab', 'Language Lab')]), term(3, [lesson('creative-voices', 'Creative Voices'), lesson('happy-letters', 'Happy Letters')])],
  Tamil: [term(1, [lesson('tamizh-arambam', 'தமிழ் ஆரம்பம்'), lesson('letter-garden', 'Letter Garden'), lesson('story-koodam', 'Story Koodam')]), term(2, [lesson('word-journey', 'Word Journey'), lesson('song-and-rhyme', 'Song and Rhyme')]), term(3, [lesson('tamizh-tales', 'Tamil Tales'), lesson('creative-tamil', 'Creative Tamil')])],
  EVS: [term(1, [lesson('family-friends', 'My Family and Friends'), lesson('senses-safety', 'Senses and Safety'), lesson('living-nearby', 'Living Nearby')]), term(2, [lesson('plants-around-us', 'Plants Around Us'), lesson('water-wonders', 'Water Wonders')]), term(3, [lesson('earth-home', 'Our Earth Home'), lesson('healthy-habits', 'Healthy Habits')])],
  Math: [term(1, [lesson('number-adventure', 'Number Adventure'), lesson('shape-city', 'Shape City'), lesson('patterns-play', 'Patterns at Play')]), term(2, [lesson('measure-magic', 'Measure Magic'), lesson('time-travel', 'Time Travel')]), term(3, [lesson('data-detectives', 'Data Detectives'), lesson('math-mission', 'Math Mission')])],
  Science: [term(1, [lesson('wonder-lab', 'Wonder Lab'), lesson('matter-magic', 'Matter Magic'), lesson('sky-watchers', 'Sky Watchers')]), term(2, [lesson('energy-explorers', 'Energy Explorers'), lesson('nature-detectives', 'Nature Detectives')]), term(3, [lesson('body-brilliant', 'Body Brilliant'), lesson('future-scientists', 'Future Scientists')])]
};

const subjectStyles = {
  English: ['Aa', 'violet'], Tamil: ['அ', 'coral'], EVS: ['🌿', 'green'], Math: ['＋', 'blue'], Science: ['⚗', 'gold']
};

export const curriculum = Array.from({ length: 5 }, (_, index) => {
  const number = index + 1;
  return {
    id: `grade-${number}`,
    title: `Grade ${number}`,
    icon: ['🚀', '🦊', '🌈', '🪐', '🏆'][index],
    tagline: ['Start the adventure', 'Discover new worlds', 'Learn with wonder', 'Think bigger', 'Lead the way'][index],
    subjects: Object.entries(template).map(([title, terms]) => {
      const [icon, accent] = subjectStyles[title];
      return subject(title, icon, accent, terms);
    })
  };
});
