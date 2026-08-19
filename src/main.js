import './styles.css';
import { curriculum } from './data/curriculum.js';

const state = { grade: null, subject: null, term: null, lesson: null, modal: null, vrMode: false };
const app = document.querySelector('#app');
const resolve = () => ({
  grade: curriculum.find(g => g.id === state.grade),
  subject: curriculum.find(g => g.id === state.grade)?.subjects.find(s => s.id === state.subject),
  term: curriculum.find(g => g.id === state.grade)?.subjects.find(s => s.id === state.subject)?.terms.find(t => String(t.id) === String(state.term)),
  lesson: curriculum.find(g => g.id === state.grade)?.subjects.find(s => s.id === state.subject)?.terms.find(t => String(t.id) === String(state.term))?.lessons.find(l => l.id === state.lesson)
});

function card({ label, title, icon, detail, className = '', action }) {
  return `<button class="card ${className}" data-action="${action}"><span class="card-icon">${icon}</span><span class="card-copy"><strong>${title}</strong>${detail ? `<small>${detail}</small>` : ''}</span><span class="arrow">→</span></button>`;
}
function render() {
  const { grade, subject, term, lesson } = resolve();
  const crumbs = [grade?.title, subject?.title, term?.title, lesson?.title].filter(Boolean);
  let heading = 'Choose your grade', subtitle = 'Every lesson is a doorway to a new world of discovery.', content = '';
  if (!grade) content = curriculum.map(g => card({ title: g.title, icon: g.icon, detail: g.tagline, className: 'grade-card', action: `grade:${g.id}` })).join('');
  else if (!subject) { heading = `Hello, ${grade.title}!`; subtitle = 'What would you like to explore today?'; content = grade.subjects.map(s => card({ title: s.title, icon: s.icon, detail: 'Explore lessons', className: `subject-card ${s.accent}`, action: `subject:${s.id}` })).join(''); }
  else if (!term) { heading = `${subject.title} learning path`; subtitle = `Select a term to begin your ${grade.title} adventure.`; content = subject.terms.map((t, i) => card({ title: t.title, icon: ['🌱', '🧭', '✨'][i], detail: `${t.lessons.length} joyful lessons`, className: 'term-card', action: `term:${t.id}` })).join(''); }
  else if (!lesson) { heading = term.title; subtitle = `Choose a lesson in ${subject.title}.`; content = term.lessons.map((l, i) => card({ title: l.title, icon: String(i + 1).padStart(2, '0'), detail: `Lesson ${i + 1} · ${l.concepts.length} VR concepts`, className: 'lesson-card', action: `lesson:${l.id}` })).join(''); }
  else {
    heading = lesson.title;
    subtitle = 'Pick a concept and step into an immersive lesson.';
    const LIVE_CONCEPTS = {
      'family-friends-explore':  '/vr/family-friends/concept-1/index.html',
      'family-friends-discover': '/vr/family-friends/concept-2/index.html'
    };
    content = lesson.concepts.map(c => {
      const isLive = c.id in LIVE_CONCEPTS;
      return card({
        title: c.title,
        icon: c.icon,
        detail: isLive ? 'Start VR experience ✦' : 'VR learning · Coming soon',
        className: `concept-card${isLive ? ' live' : ''}`,
        action: `concept:${c.id}`
      });
    }).join('');
  }
  const modeSwitch = !grade ? `<button class="mode-switch ${state.vrMode ? 'active' : ''}" data-action="vr-mode"><span>◉</span><span><b>${state.vrMode ? 'Headset Mode On' : 'Headset Mode'}</b><small>${state.vrMode ? 'Large, gaze-friendly view' : 'Switch to a VR-friendly layout'}</small></span><i>${state.vrMode ? 'ON' : 'TRY'}</i></button>` : '';
  app.innerHTML = `<main class="${state.vrMode ? 'vr-ui' : ''}"><header><img src="/assets/NETCOM_logo.png" alt="NETCOM" /><div class="brand-divider"></div><div><p>NETCOM EDUCATION</p><h1>VR Learning <span>— Immersive Lessons</span></h1></div><div class="sparkles">✦ &nbsp; ✧ &nbsp; ✦</div></header><section class="hero"><div class="breadcrumb">${crumbs.length ? `<button data-action="back">‹ Back</button><span>${crumbs.join('<b>›</b>')}</span>` : '<span>Home</span>'}</div><div class="eyebrow">${state.vrMode ? 'HEADSET-READY LEARNING' : 'LEARN · EXPLORE · IMAGINE'}</div><h2>${heading}</h2><p>${state.vrMode && !grade ? 'Choose a large, comfortable card with your controller or gaze.' : subtitle}</p>${modeSwitch}</section><section class="grid level-${crumbs.length}">${content}</section><footer><span>Made for curious minds</span><span>✦</span><span>${state.vrMode ? 'Headset mode · Large controls enabled' : 'Your VR learning journey starts here'}</span></footer></main>${state.modal ? `<div class="overlay"><div class="modal"><span class="modal-star">✦</span><h3>Coming Soon!</h3><p>This immersive VR experience is being crafted for your next adventure.</p><button data-action="close">Keep exploring</button></div></div>` : ''}`;
}
function navigate(action) {
  const [type, id] = action.split(':');
  if (type === 'grade') Object.assign(state, { grade: id, subject: null, term: null, lesson: null });
  if (type === 'subject') Object.assign(state, { subject: id, term: null, lesson: null });
  if (type === 'term') Object.assign(state, { term: id, lesson: null });
  if (type === 'lesson') state.lesson = id;
  if (type === 'concept') {
    const LIVE = {
      'family-friends-explore':  '/vr/family-friends/concept-1/index.html',
      'family-friends-discover': '/vr/family-friends/concept-2/index.html'
    };
    if (id in LIVE) { window.location.href = LIVE[id]; return; }
    state.modal = id;
  }
  if (type === 'vr-mode') state.vrMode = !state.vrMode;
  if (type === 'close') state.modal = null;
  if (type === 'back') { if (state.lesson) state.lesson = null; else if (state.term) state.term = null; else if (state.subject) state.subject = null; else state.grade = null; }
  render();
}
app.addEventListener('click', event => { const button = event.target.closest('[data-action]'); if (button) navigate(button.dataset.action); });
render();
