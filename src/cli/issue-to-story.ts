/**
 * Usado pelo workflow "História a partir de issue": grava stories/<id>-<titulo>.md
 * a partir da issue do evento. Lê ISSUE_NUMBER, ISSUE_TITLE, ISSUE_BODY e ISSUE_URL.
 *
 *   npm run story:from-issue
 *
 * Em caso de erro, explica o problema em issue-feedback.txt (o workflow comenta na issue).
 */
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { IssueStoryError, issueToStory } from '../story/issue-form';

const STORIES_DIR = path.resolve('stories');
const FEEDBACK_FILE = 'issue-feedback.txt';

function fail(problems: string[]): never {
  const text = problems.map((p) => `- ${p}`).join('\n');
  fs.writeFileSync(FEEDBACK_FILE, `${text}\n`);
  console.error(text);
  process.exit(1);
}

function main() {
  const story = issueToStory({
    number: Number(process.env.ISSUE_NUMBER),
    title: process.env.ISSUE_TITLE ?? '',
    body: process.env.ISSUE_BODY ?? '',
    url: process.env.ISSUE_URL ?? '',
  });

  const existing = fs
    .readdirSync(STORIES_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((file) => ({ file, data: matter(fs.readFileSync(path.join(STORIES_DIR, file), 'utf8')).data }));

  // O mesmo ID não pode ser de outra história.
  const clash = existing.find((s) => String(s.data.id) === story.id && s.data.origem !== process.env.ISSUE_URL);
  if (clash) fail([`O ID ${story.id} já é usado por stories/${clash.file}. Escolha outro na issue.`]);

  // Issue editada: a versão anterior desta mesma issue sai (o ID ou o título podem ter mudado).
  for (const old of existing.filter((s) => s.data.origem === process.env.ISSUE_URL)) {
    fs.rmSync(path.join(STORIES_DIR, old.file));
  }

  const file = path.join(STORIES_DIR, story.fileName);
  fs.writeFileSync(file, story.markdown);
  const relative = path.relative(process.cwd(), file).replace(/\\/g, '/');
  console.log(`História ${story.id} gravada em ${relative}`);

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `id=${story.id}\nfile=${relative}\n`);
  }
}

try {
  main();
} catch (err) {
  if (err instanceof IssueStoryError) fail(err.problems);
  throw err;
}
