import type { PropertyValue } from '@shared/types';

/** Starting points for new pages. Blocks are BlockNote's JSON; databases get example rows. */
export interface Template {
  id: string;
  name: string;
  icon: string;
  description: string;
  title: string;
  blocks?: unknown[];
  rows?: { title: string; props?: Record<string, PropertyValue> }[];
}

const h = (level: 1 | 2 | 3, text: string) => ({
  type: 'heading',
  props: { level },
  content: text,
});
const p = (text = '') => ({ type: 'paragraph', content: text });
const todo = (text = '') => ({ type: 'checkListItem', content: text });
const bullet = (text = '') => ({ type: 'bulletListItem', content: text });
const numbered = (text = '') => ({ type: 'numberedListItem', content: text });

export const TEMPLATES: Template[] = [
  {
    id: 'groceries',
    name: 'Shared grocery list',
    icon: '🛒',
    description: 'A live checklist for the family: ticks show up for everyone instantly.',
    title: 'Groceries',
    blocks: [
      p(
        'Share this page (Share → invite) and tick things off together. Type @ to give an item to someone or add a reminder like @saturday 10am.',
      ),
      h(3, 'Fruit & veg'),
      todo('Bananas'),
      todo('Spinach'),
      h(3, 'Pantry'),
      todo('Rice'),
      todo('Olive oil'),
      h(3, 'Household'),
      todo('Dish soap'),
    ],
  },
  {
    id: 'tasks',
    name: 'Task board',
    icon: '✅',
    description: 'A database with Status, Assignee and Due. Switch to Board for kanban.',
    title: 'Tasks',
    rows: [
      { title: 'Plan the launch', props: { status: 'doing' } },
      { title: 'Write the announcement', props: { status: 'todo' } },
      { title: 'Set up analytics', props: { status: 'done' } },
    ],
  },
  {
    id: 'meeting',
    name: 'Meeting notes',
    icon: '🗓️',
    description: 'Attendees, agenda, notes and action items.',
    title: 'Meeting notes',
    blocks: [
      h(3, 'Attendees'),
      bullet(),
      h(3, 'Agenda'),
      numbered(),
      h(3, 'Notes'),
      p(),
      h(3, 'Action items'),
      todo(),
    ],
  },
  {
    id: 'weekly',
    name: 'Weekly plan',
    icon: '🧭',
    description: 'Priorities, the rest of the week and a place for reminders.',
    title: 'This week',
    blocks: [
      h(2, 'Priorities'),
      todo('The one thing that matters most'),
      todo(),
      h(2, 'Everything else'),
      todo(),
      h(2, 'Reminders'),
      p('Search (⌘K) for something like “pay rent every 1st at 9am” to add a repeating reminder.'),
    ],
  },
  {
    id: 'brief',
    name: 'Project brief',
    icon: '🚀',
    description: 'Problem, goals, scope and timeline on one page.',
    title: 'Project brief',
    blocks: [
      h(2, 'Problem'),
      p(),
      h(2, 'Goals'),
      bullet(),
      h(2, 'Scope'),
      bullet(),
      h(2, 'Timeline'),
      p(),
    ],
  },
  {
    id: 'journal',
    name: 'Daily journal',
    icon: '📓',
    description: 'Gratitude, today, tomorrow.',
    title: new Date().toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }),
    blocks: [h(3, 'Grateful for'), bullet(), h(3, 'Today'), p(), h(3, 'Tomorrow'), todo()],
  },
];

/** "# Title\n\nBody" → title and the rest; files without a heading use their name. */
export function splitMarkdown(markdown: string, fileName: string) {
  const match = markdown.match(/^\s*#\s+(.+)\n?/);
  return match
    ? { title: match[1]!.trim(), body: markdown.slice(match[0].length) }
    : { title: fileName.replace(/\.(md|markdown|txt)$/i, ''), body: markdown };
}
