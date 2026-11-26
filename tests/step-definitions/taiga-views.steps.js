'use strict';

// A project's screens: its backlog (the user stories not planned yet, and each open sprint with its own beside them),
// the taskboard of a sprint (a row for each of its user stories, and the user story's tasks in a column for each
// task status), the Kanban board (a column for each status of the user stories), and the project's search. And who
// may open the project at all: a project the session is not a member of is not found.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./taiga-helpers');

/** Open a screen of a project by its name: its address is the project's slug and the screen's. */
async function openScreen(world, name, screen, ready) {
  const project = await h.findProject(world, name);
  const s = h.state(world);
  s.project = project.name;
  s.slug = project.slug;
  await h.open(world, `/project/${project.slug}/${screen}`);
  if (ready) await world.page.locator(ready).first().waitFor({ state: 'visible', timeout: h.budget(world) }).catch(() => {});
  return project;
}

/** The project of the scenario's last screen, else worldParameters.project. */
async function screenProject(world) {
  const s = h.state(world);
  if (s.slug && s.project) return { slug: s.slug, name: s.project };
  const project = await h.findProject(world, (world.parameters && world.parameters.project) || '');
  s.project = project.name;
  s.slug = project.slug;
  return project;
}

/**
 * Open a project's backlog: its user stories not planned yet, and its open sprints beside them.
 *
 * Example #1: When I open the backlog of the project "Webship site"
 * Example #2: When open the backlog of the project "Webship site"
 * Example #3: And I open the backlog of the project "Webship site"
 * Example #4: And open the backlog of the project "Webship site"
 * Example #5: When we open the backlog of the project "Webship site"
 */
When(/^(I |we )*open the backlog of the project "([^"]*)"$/, async function (_who, name) {
  await openScreen(this, name, 'backlog', '.backlog-table-body, .sprints, .not-found');
});

/**
 * The backlog shows (or does not show) a user story among the ones not planned yet.
 *
 * Example #1: Then the backlog should show the user story "The usage line spells greeting as greting"
 * Example #2: Then the backlog should not show the user story "The greeting script says Helo instead of Hello"
 * Example #3: And the backlog should show the user story "Webship test new"
 * Example #4: But the backlog should not show the user story "Webship test planned"
 * Example #5: Given the backlog should show the user story "The usage line spells greeting as greting"
 */
Then(/^the backlog should( not)? show the user story "([^"]*)"$/, async function (notCase, subject) {
  const rows = this.page.locator('.backlog-table-body .us-item-row .user-story-name').filter({ hasText: h.exactly(subject) });
  await h.assertPresence(rows, notCase, { label: `the user story "${subject}" in the backlog`, hint: 'The backlog lists the user stories not in a sprint; a sprint\'s own are beside it, under the sprint\'s name.', timeout: h.budget(this) });
});

/**
 * A sprint on the backlog shows (or does not show) a user story among its own.
 *
 * Example #1: Then the sprint "Sprint 1" should show the user story "The greeting script says Helo instead of Hello"
 * Example #2: Then the sprint "Sprint 1" should not show the user story "The usage line spells greeting as greting"
 * Example #3: And the sprint "Sprint 1" should show the user story "Add a test for the greeting"
 * Example #4: But the sprint "Sprint 1" should not show the user story "Webship test new"
 * Example #5: Given the sprint "Sprint 1" should show the user story "Webship test planned"
 */
Then(/^the sprint "([^"]*)" should( not)? show the user story "([^"]*)"$/, async function (sprint, notCase, subject) {
  const page = this.page;
  const panel = page.locator('.sprints .sprint').filter({ has: page.locator('.sprint-name', { hasText: h.exactly(sprint) }) }).first();
  await h.assertPresence(panel, null, { label: `the sprint "${sprint}" on the backlog`, hint: 'Open the backlog of the project first; it shows its open sprints beside the user stories not planned yet.', timeout: h.budget(this) });
  const rows = panel.locator('a, span').filter({ hasText: h.exactly(subject) });
  await h.assertPresence(rows, notCase, { label: `the user story "${subject}" in the sprint "${sprint}"`, hint: 'A sprint lists its own user stories under its name, on the backlog.', timeout: h.budget(this) });
});

/**
 * Add a user story to the backlog of the project on screen: the backlog's "+ User story", its subject, Create; and
 * wait until the backlog lists it. It goes after the scenario.
 *
 * Example #1: When I add the user story "Webship test new" to the backlog
 * Example #2: When add the user story "Webship test made" to the backlog
 * Example #3: And I add the user story "Webship test new" to the backlog
 * Example #4: And add the user story "Webship test made" to the backlog
 * Example #5: When we add the user story "Webship test new" to the backlog
 */
When(/^(I |we )*add the user story "([^"]*)" to the backlog$/, async function (_who, subject) {
  const project = await screenProject(this);
  const page = this.page;
  h.rememberSubject(this, project.name, subject);
  await h.actOrExplain('add a user story', subject, async () => {
    await page.locator('button.btn-small').filter({ hasText: /^\s*user story\s*$/i }).first().click({ timeout: h.budget(this) });
    const box = page.locator('.lightbox-create-edit.open').first();
    await box.locator('input[name="subject"]').fill(subject, { timeout: h.budget(this) });
    await box.locator('button[type="submit"]').first().click({ timeout: h.budget(this) });
    await box.waitFor({ state: 'hidden', timeout: h.budget(this) });
  }, 'Open the backlog of the project first: "+ User story" is above its list, and opens a form for the new user story. A reader has no such button.');
  const row = page.locator('.backlog-table-body .us-item-row .user-story-name').filter({ hasText: h.exactly(subject) });
  await h.assertPresence(row, null, { label: `the user story "${subject}" in the backlog`, hint: 'A user story the site made shows in the backlog at once.', timeout: h.budget(this) });
});

/**
 * The backlog on screen offers the session no way to add a user story.
 *
 * Example #1: Then I should not be able to add a user story
 * Example #2: Then we should not be able to add a user story
 * Example #3: And I should not be able to add a user story
 * Example #4: But we should not be able to add a user story
 * Example #5: Given I should not be able to add a user story
 */
Then(/^(I |we )*should not be able to add a user story$/, async function (_who) {
  const page = this.page;
  await page.locator('.backlog-table-body, .sprints').first().waitFor({ state: 'visible', timeout: h.budget(this) });
  const add = page.locator('button[ng-click*="addNewUs"]').filter({ visible: true });
  if (await add.count()) throw friendly({ message: 'Expected no way to add a user story, but the backlog offers one.', hint: 'Sign in with a role that only views the project, such as reader.' });
});

/**
 * Open the taskboard of a sprint: a row for each of its user stories, their tasks in a column for each task status.
 *
 * Example #1: When I open the taskboard of the sprint "Sprint 1" of the project "Webship site"
 * Example #2: When open the taskboard of the sprint "Sprint 1" of the project "Webship site"
 * Example #3: And I open the taskboard of the sprint "Sprint 1" of the project "Webship site"
 * Example #4: And open the taskboard of the sprint "Sprint 1" of the project "Webship site"
 * Example #5: When we open the taskboard of the sprint "Sprint 1" of the project "Webship site"
 */
When(/^(I |we )*open the taskboard of the sprint "([^"]*)" of the project "([^"]*)"$/, async function (_who, sprint, name) {
  const project = await h.findProject(this, name);
  const found = await h.findSprint(this, project, sprint);
  const s = h.state(this);
  s.project = project.name;
  s.slug = project.slug;
  await h.open(this, `/project/${project.slug}/taskboard/${found.slug}`);
  await this.page.locator('.taskboard-table').first().waitFor({ state: 'visible', timeout: h.budget(this) }).catch(() => {});
});

/** The taskboard's row of a user story. */
function taskboardRow(world, subject) {
  return world.page.locator('.taskboard-row').filter({ has: world.page.locator('.us-subject', { hasText: h.exactly(subject) }) }).first();
}

/**
 * The taskboard on screen shows (or does not show) a row for a user story.
 *
 * Example #1: Then the taskboard should show the user story "The greeting script says Helo instead of Hello"
 * Example #2: Then the taskboard should not show the user story "The usage line spells greeting as greting"
 * Example #3: And the taskboard should show the user story "Add a test for the greeting"
 * Example #4: But the taskboard should not show the user story "The usage line spells greeting as greting"
 * Example #5: Given the taskboard should show the user story "Webship test board"
 */
Then(/^the taskboard should( not)? show the user story "([^"]*)"$/, async function (notCase, subject) {
  const rows = this.page.locator('.taskboard-row .us-subject').filter({ hasText: h.exactly(subject) });
  await h.assertPresence(rows, notCase, { label: `the user story "${subject}" on the taskboard`, hint: 'The taskboard has a row for each user story of the sprint.', timeout: h.budget(this) });
});

/**
 * The taskboard on screen shows a task in a column (a task status), in the row of its user story.
 *
 * Example #1: Then the taskboard should show the task "Fix the spelling in greeting.sh" in the column "New"
 * Example #2: Then the taskboard should show the task "Fix the spelling in greeting.sh" in the column "New"
 * Example #3: And the taskboard should show the task "Fix the spelling in greeting.sh" in the column "New"
 * Example #4: But the taskboard should show the task "Fix the spelling in greeting.sh" in the column "New"
 * Example #5: Given the taskboard should show the task "Fix the spelling in greeting.sh" in the column "New"
 */
Then(/^the taskboard should show the task "([^"]*)" in the column "([^"]*)"$/, async function (task, column) {
  const page = this.page;
  await page.locator('.taskboard-table').first().waitFor({ state: 'visible', timeout: h.budget(this) });
  const at = await h.columnIndex(this, page.locator('.taskboard-table-header .task-colum-name'), column);
  if (at < 0) throw friendly({ message: `The taskboard has no column "${column}".`, hint: 'Its columns are the project\'s task statuses (New, In progress, Ready for test, Closed, Needs Info in the Scrum template).' });
  const cell = page.locator('.taskboard-row').filter({ hasText: new RegExp(h.words(task), 'i') }).first().locator(':scope > .taskboard-column').nth(at);
  await h.assertPresence(cell.filter({ hasText: new RegExp(h.words(task), 'i') }), null, { label: `the task "${task}" in the column "${column}"`, hint: 'A task is in its user story\'s row, in the column of its status.', timeout: h.budget(this) });
});

/**
 * Open a project's Kanban board: a column for each status of its user stories.
 *
 * Example #1: When I open the kanban board of the project "Webship site"
 * Example #2: When open the kanban board of the project "Webship site"
 * Example #3: And I open the kanban board of the project "Webship site"
 * Example #4: And open the kanban board of the project "Webship site"
 * Example #5: When we open the kanban board of the project "Webship site"
 */
When(/^(I |we )*open the kanban board of the project "([^"]*)"$/, async function (_who, name) {
  await openScreen(this, name, 'kanban', '.kanban-table');
});

/**
 * A column of the Kanban board on screen shows (or does not show) a user story.
 *
 * Example #1: Then the column "In progress" should show the user story "The greeting script says Helo instead of Hello"
 * Example #2: Then the column "New" should not show the user story "The greeting script says Helo instead of Hello"
 * Example #3: And the column "Done" should show the user story "Add a test for the greeting"
 * Example #4: But the column "Done" should not show the user story "The usage line spells greeting as greting"
 * Example #5: Given the column "New" should show the user story "The usage line spells greeting as greting"
 */
Then(/^the column "([^"]*)" should( not)? show the user story "([^"]*)"$/, async function (column, notCase, subject) {
  const page = this.page;
  await page.locator('.kanban-table').first().waitFor({ state: 'visible', timeout: h.budget(this) });
  const at = await h.columnIndex(this, page.locator('.kanban-table-header .task-colum-name .name'), column);
  if (at < 0) throw friendly({ message: `The Kanban board has no column "${column}".`, hint: 'Its columns are the project\'s statuses of user stories (New, Ready, In progress, Ready for test, Done in the Scrum template).' });
  const cards = page.locator('.kanban-uses-box').nth(at).locator('tg-card').filter({ hasText: new RegExp(h.words(subject), 'i') });
  await h.assertPresence(cards, notCase, { label: `the user story "${subject}" in the column "${column}"`, hint: 'A user story is in the column of its status.', timeout: h.budget(this) });
});

/**
 * Search a project: its search screen, with the words in its field.
 *
 * Example #1: When I search the project "Webship site" for "greting"
 * Example #2: When search the project "Webship site" for "greeting"
 * Example #3: And I search the project "Webship site" for "greting"
 * Example #4: And search the project "Webship site" for "greeting"
 * Example #5: When we search the project "Webship site" for "greting"
 */
When(/^(I |we )*search the project "([^"]*)" for "([^"]*)"$/, async function (_who, name, words) {
  await openScreen(this, name, `search?text=${encodeURIComponent(words)}`, '.search-result-table, .search-filter');
});

/**
 * The project's search on screen shows (or does not show) a user story among what it found.
 *
 * Example #1: Then the search should show the user story "The usage line spells greeting as greting"
 * Example #2: Then the search should not show the user story "The greeting script says Helo instead of Hello"
 * Example #3: And the search should show the user story "The usage line spells greeting as greting"
 * Example #4: But the search should not show the user story "Add a test for the greeting"
 * Example #5: Given the search should show the user story "The usage line spells greeting as greting"
 */
Then(/^the search should( not)? show the user story "([^"]*)"$/, async function (notCase, subject) {
  const found = this.page.locator('.search-result-table a, .search-result-table span').filter({ hasText: h.exactly(subject) });
  await h.assertPresence(found, notCase, { label: `the user story "${subject}" among what the search found`, hint: 'The search lists the user stories it found under User Stories, with their sprint and status.', timeout: h.budget(this) });
});

/**
 * A project the session may not open: its pages are not found.
 *
 * Example #1: Then I should be refused the project "Webship site"
 * Example #2: Then we should be refused the project "Webship site"
 * Example #3: And I should be refused the project "Webship site"
 * Example #4: But we should be refused the project "Webship site"
 * Example #5: Given I should be refused the project "Webship site"
 */
Then(/^(I |we )*should be refused the project "([^"]*)"$/, async function (_who, name) {
  const project = await h.findProject(this, name);
  await h.open(this, `/project/${project.slug}/backlog`);
  const page = this.page;
  const refused = page.getByText(/Error 404\. The page you are looking for no longer exists/).first();
  await h.assertPresence(refused, null, { label: `the site's "Not found" (Error 404) for the project "${name}"`, hint: 'A private project is not found for an account it does not have; a visitor is sent to the sign-in form instead.', timeout: h.budget(this) });
  if (await page.locator('.backlog-table-body .us-item-row').count()) throw friendly({ message: `The project "${name}" showed its backlog.`, hint: 'Sign in with an account the project does not have, such as stranger.' });
});
