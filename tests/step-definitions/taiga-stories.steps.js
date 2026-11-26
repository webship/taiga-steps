'use strict';

// Test content and one user story.
//
// A scenario makes its own user stories through the site's REST API, as the managing account, and they go after it. A
// user story has a page of its own, at /project/<project>/us/<number>: its subject, its tags (Add tag), who made it,
// its description, its tasks and its comments (a rich text editor, then Save), and beside them its status (a menu),
// its assigned users (Add assigned, a list of the project's members) and its watchers. Each step works on that page
// and waits for it to show what it did; what a role may not do is not offered there at all.

const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./taiga-helpers');

/** The project a step works in: the scenario's last, else worldParameters.project. */
function projectName(world) {
  return h.state(world).project || (world.parameters && world.parameters.project) || '';
}

/** The open user story's status, as its page names it (the page shows it in capitals). */
async function statusShown(world) {
  return h.tidy(await world.page.locator('.detail-status-inner').first().textContent({ timeout: 2000 }));
}

/** The names of the open user story's assigned users, as its page lists them in the sidebar, under Assigned. */
async function assignedShown(world) {
  const names = await world.page.locator('.ticket-assigned-users .ticket-user-list .user-list-name, .ticket-assigned-to .assigned-to').allInnerTexts().catch(() => []);
  return names.map(h.tidy).filter(Boolean).join(', ');
}

/**
 * A user story of the scenario's own, made through the site's API as the managing account in the backlog of a
 * project, in the project's first status; it goes after the scenario. Name it "Webship test …".
 *
 * Example #1: Given there is a user story "Webship test work" in the project "Webship site"
 * Example #2: Given there is a user story "Webship test status" in the project "Webship site"
 * Example #3: And there is a user story "Webship test work" in the project "Webship site"
 * Example #4: And there is a user story "Webship test tag" in the project "Webship site"
 * Example #5: When there is a user story "Webship test assign" in the project "Webship site"
 */
Given(/^there is a user story "([^"]*)" in the project "([^"]*)"$/, async function (subject, name) {
  const project = await h.findProject(this, name);
  h.state(this).project = project.name;
  await h.makeStory(this, project, subject);
});

/**
 * A user story of the scenario's own in a status of the project; it goes after the scenario.
 *
 * Example #1: Given there is a user story "Webship test ready" with the status "Ready" in the project "Webship site"
 * Example #2: Given there is a user story "Webship test done" with the status "Done" in the project "Webship site"
 * Example #3: And there is a user story "Webship test ready" with the status "Ready" in the project "Webship site"
 * Example #4: And there is a user story "Webship test going" with the status "In progress" in the project "Webship site"
 * Example #5: When there is a user story "Webship test done" with the status "Done" in the project "Webship site"
 */
Given(/^there is a user story "([^"]*)" with the status "([^"]*)" in the project "([^"]*)"$/, async function (subject, status, name) {
  const project = await h.findProject(this, name);
  h.state(this).project = project.name;
  await h.makeStory(this, project, subject, { status });
});

/**
 * A user story of the scenario's own in a sprint of the project; it goes after the scenario.
 *
 * Example #1: Given there is a user story "Webship test planned" in the sprint "Sprint 1" of the project "Webship site"
 * Example #2: Given there is a user story "Webship test board" in the sprint "Sprint 1" of the project "Webship site"
 * Example #3: And there is a user story "Webship test planned" in the sprint "Sprint 1" of the project "Webship site"
 * Example #4: And there is a user story "Webship test board" in the sprint "Sprint 1" of the project "Webship site"
 * Example #5: When there is a user story "Webship test planned" in the sprint "Sprint 1" of the project "Webship site"
 */
Given(/^there is a user story "([^"]*)" in the sprint "([^"]*)" of the project "([^"]*)"$/, async function (subject, sprint, name) {
  const project = await h.findProject(this, name);
  h.state(this).project = project.name;
  await h.makeStory(this, project, subject, { sprint });
});

/**
 * No user story of this subject in a project: the ones a stopped run left are removed first, as the managing account.
 *
 * Example #1: Given there is no user story "Webship test new" in the project "Webship site"
 * Example #2: Given there is no user story "Webship test made" in the project "Webship site"
 * Example #3: And there is no user story "Webship test new" in the project "Webship site"
 * Example #4: And there is no user story "Webship test made" in the project "Webship site"
 * Example #5: When there is no user story "Webship test new" in the project "Webship site"
 */
Given(/^there is no user story "([^"]*)" in the project "([^"]*)"$/, async function (subject, name) {
  const project = await h.findProject(this, name);
  h.state(this).project = project.name;
  for (const us of await h.findStories(this, project, subject)) await h.removeStory(this, us.id);
});

/**
 * Open a user story's page: by its subject, in the project of the scenario (else worldParameters.project).
 *
 * Example #1: When I open the user story "The greeting script says Helo instead of Hello"
 * Example #2: When open the user story "Webship test work"
 * Example #3: And I open the user story "The usage line spells greeting as greting"
 * Example #4: And open the user story "Webship test work"
 * Example #5: When we open the user story "Add a test for the greeting"
 */
When(/^(I |we )*open the user story "([^"]*)"$/, async function (_who, subject) {
  const { project, story } = await h.storyNamed(this, subject, projectName(this));
  await h.showStory(this, project, story);
});

/**
 * Change the open user story's status with its status menu, and wait until its page shows the new one.
 *
 * Example #1: When I change the status of the user story to "Ready"
 * Example #2: When change the status of the user story to "In progress"
 * Example #3: And I change the status of the user story to "Done"
 * Example #4: And change the status of the user story to "Ready for test"
 * Example #5: When we change the status of the user story to "Ready"
 */
When(/^(I |we )*change the status of the user story to "([^"]*)"$/, async function (_who, status) {
  h.openStory(this);
  const page = this.page;
  await h.actOrExplain('change the status', `the status "${status}"`, async () => {
    const options = page.locator('.detail-status ul li a.status');
    if (!(await options.first().isVisible().catch(() => false))) await page.locator('.detail-status-inner').first().click({ timeout: h.budget(this) });
    await options.filter({ hasText: h.exactly(status) }).first().click({ timeout: h.budget(this) });
  }, 'The status menu opens from the status beside the subject, at the top of the sidebar; it lists the project\'s statuses. A reader has no such menu.');
  const shown = await h.waitForValue(() => statusShown(this), (s) => h.exactly(status).test(s), h.budget(this));
  if (!shown.ok) throw friendly({ message: `The user story's status did not become "${status}"; the page shows "${shown.value}".`, hint: 'Name a status of the project, as its status menu lists it.' });
});

/**
 * The open user story has a status, as its page shows it and as the site keeps it.
 *
 * Example #1: Then the user story should have the status "Ready"
 * Example #2: Then the user story should have the status "In progress"
 * Example #3: And the user story should have the status "New"
 * Example #4: But the user story should have the status "Done"
 * Example #5: Given the user story should have the status "Ready"
 */
Then(/^the user story should have the status "([^"]*)"$/, async function (status) {
  h.openStory(this);
  const shown = await h.waitForValue(() => statusShown(this), (s) => h.exactly(status).test(s), h.budget(this));
  if (!shown.ok) throw friendly({ message: `Expected the user story's status "${status}", but its page shows "${shown.value}".`, hint: 'The status is shown beside the subject, at the top of the sidebar.' });
  const kept = await h.storyNow(this);
  const name = String((kept.status_extra_info && kept.status_extra_info.name) || '');
  if (!h.exactly(status).test(name)) throw friendly({ message: `The page shows "${status}", but the site keeps the status "${name}".`, hint: 'Reload the page: another session may have changed it.' });
});

/**
 * Write a comment on the open user story with its comment editor, Save, and wait until the comment is on its page.
 *
 * Example #1: When I add the comment "Checked on the test site" to the user story
 * Example #2: When add the comment "Fixed in greeting.sh" to the user story
 * Example #3: And I add the comment "Checked on the test site" to the user story
 * Example #4: And add the comment "Fixed in greeting.sh" to the user story
 * Example #5: When we add the comment "Checked on the test site" to the user story
 */
When(/^(I |we )*add the comment "([^"]*)" to the user story$/, async function (_who, text) {
  h.openStory(this);
  const page = this.page;
  const box = page.locator('tg-comments tg-comment-wysiwyg tg-wysiwyg').first();
  await h.actOrExplain('add a comment', 'the comment editor', async () => {
    // What the step before did may still be redrawing the page (a change reloads the user story's history).
    await h.smartSettle(page, 5000);
    const editor = box.locator('.ck-editor__editable').first();
    const editing = box.locator('.editor.edit-mode').first();
    // The editor turns to its edit mode, with Save, when it gets the focus: a click, or a second one after a blur.
    for (let attempt = 0; attempt < 3 && !(await editing.isVisible().catch(() => false)); attempt += 1) {
      if (attempt) await editor.evaluate((el) => el.blur()).catch(() => {});
      await editor.click({ timeout: h.budget(this) });
      await editing.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
    }
    await editing.waitFor({ state: 'visible', timeout: h.budget(this) });
    await page.keyboard.type(text);
    // The site takes the editor's text a moment later (and keeps it as a draft in the page's storage): Save sends what
    // it has taken, so the step waits until the draft holds the whole text; another key gives it one more change.
    const drafted = () => page.waitForFunction((wanted) => Object.keys(window.localStorage)
      .some((k) => /comment/.test(k) && String(window.localStorage.getItem(k) || '').includes(wanted)), JSON.stringify(text).slice(1, -1), { timeout: 5000 });
    if (!(await drafted().then(() => true).catch(() => false))) {
      await page.keyboard.type(' ');
      await page.keyboard.press('Backspace');
      await drafted();
    }
    const save = box.locator('.tools a.btn-small').filter({ hasText: /^\s*Save\s*$/i }).first();
    await save.waitFor({ state: 'visible', timeout: h.budget(this) });
    await save.click({ timeout: h.budget(this) });
  }, 'The comment editor is under the comments of the user story ("Type a new comment here"), with Save under it once something is written. A role that may not comment has no editor.');
  const posted = page.locator('tg-comments .comment-wrapper').filter({ hasText: new RegExp(h.words(text), 'i') }).first();
  await h.assertPresence(posted, null, { label: `the comment "${text}"`, hint: 'A comment the site took shows under the user story with its author and its time.', timeout: h.budget(this) });
});

/**
 * A comment on the open user story, as its page shows it; with "by", its author's name too.
 *
 * Example #1: Then the user story should show the comment "Seen on the test site: the greeting prints Helo."
 * Example #2: Then the user story should show the comment "Checked on the test site"
 * Example #3: And the user story should show the comment "Checked on the test site"
 * Example #4: But the user story should show the comment "Seen on the test site: the greeting prints Helo."
 * Example #5: Given the user story should show the comment "Checked on the test site"
 */
Then(/^the user story should show the comment "([^"]*)"$/, async function (text) {
  h.openStory(this);
  const shown = this.page.locator('tg-comments .comment-wrapper').filter({ hasText: new RegExp(h.words(text), 'i') }).first();
  await h.assertPresence(shown, null, { label: `the comment "${text}"`, hint: 'The comments are under the user story\'s tasks, newest last.', timeout: h.budget(this) });
});

/**
 * A comment on the open user story by a person: their full name, as the site shows it beside the comment.
 *
 * Example #1: Then the user story should show the comment "Checked on the test site" by "Member Test"
 * Example #2: Then the user story should show the comment "Seen on the test site: the greeting prints Helo." by "Owner Test"
 * Example #3: And the user story should show the comment "Checked on the test site" by "Member Test"
 * Example #4: But the user story should show the comment "Seen on the test site: the greeting prints Helo." by "Owner Test"
 * Example #5: Given the user story should show the comment "Checked on the test site" by "Member Test"
 */
Then(/^the user story should show the comment "([^"]*)" by "([^"]*)"$/, async function (text, who) {
  h.openStory(this);
  const shown = this.page.locator('tg-comments .comment-wrapper')
    .filter({ hasText: new RegExp(h.words(text), 'i') })
    .filter({ hasText: new RegExp(h.words(who), 'i') }).first();
  await h.assertPresence(shown, null, { label: `the comment "${text}" by ${who}`, hint: 'Name the author by the full name the site shows beside the comment.', timeout: h.budget(this) });
});

/**
 * Tag the open user story: Add tag, the tag's name, Enter; and wait until the tag is on its page. The site's tags are
 * free: a name the project has no tag for becomes a new one.
 *
 * Example #1: When I add the tag "bug" to the user story
 * Example #2: When add the tag "bug" to the user story
 * Example #3: And I add the tag "bug" to the user story
 * Example #4: And add the tag "bug" to the user story
 * Example #5: When we add the tag "bug" to the user story
 */
When(/^(I |we )*add the tag "([^"]*)" to the user story$/, async function (_who, tag) {
  h.openStory(this);
  const page = this.page;
  const line = page.locator('tg-tag-line').first();
  await h.actOrExplain('add a tag', `the tag "${tag}"`, async () => {
    await line.locator('button[title="Add tag"]').first().click({ timeout: h.budget(this) });
    const input = line.locator('.add-tag-input input.tag-input').first();
    await input.fill(tag, { timeout: h.budget(this) });
    // The field takes what is typed a moment later; then a tag the project has is picked from the list under the
    // field (with its colour), and a new one is added with the field's own Add.
    const known = line.locator('.tags-dropdown li').filter({ has: page.locator('.tags-dropdown-name', { hasText: h.exactly(tag) }) }).first();
    if (await known.waitFor({ state: 'visible', timeout: 2000 }).then(() => true).catch(() => false)) await known.click({ timeout: h.budget(this) });
    else await line.locator('.add-tag-input .save').first().click({ timeout: h.budget(this) });
  }, 'Add tag is under the subject of the user story; it opens a field for the tag\'s name, with the project\'s tags that match under it. A reader has no Add tag.');
  await h.assertPresence(line.locator('.tag').filter({ hasText: new RegExp('^\\s*' + h.words(tag), 'i') }), null, { label: `the tag "${tag}"`, hint: 'A tag the site took shows under the subject.', timeout: h.budget(this) });
});

/**
 * The open user story has (or has not) a tag, as its page shows it.
 *
 * Example #1: Then the user story should have the tag "bug"
 * Example #2: Then the user story should not have the tag "bug"
 * Example #3: And the user story should have the tag "bug"
 * Example #4: But the user story should not have the tag "bug"
 * Example #5: Given the user story should have the tag "bug"
 */
Then(/^the user story should( not)? have the tag "([^"]*)"$/, async function (notCase, tag) {
  h.openStory(this);
  const tags = this.page.locator('tg-tag-line .tag').filter({ hasText: new RegExp('^\\s*' + h.words(tag), 'i') });
  await h.assertPresence(tags, notCase, { label: `the tag "${tag}"`, hint: 'The tags are under the subject of the user story.', timeout: h.budget(this) });
});

/**
 * Assign the open user story to a member of the project: Add assigned, the person in the list, Add; and wait until
 * the page shows them among its assigned users.
 *
 * Example #1: When I assign the user story to "Member Test"
 * Example #2: When assign the user story to "Owner Test"
 * Example #3: And I assign the user story to "Member Test"
 * Example #4: And assign the user story to "Owner Test"
 * Example #5: When we assign the user story to "Member Test"
 */
When(/^(I |we )*assign the user story to "([^"]*)"$/, async function (_who, who) {
  h.openStory(this);
  const page = this.page;
  await h.actOrExplain('assign the user story', who, async () => {
    await page.getByText('Add assigned', { exact: true }).first().click({ timeout: h.budget(this) });
    const box = page.locator('.lightbox-select-user.open').first();
    await box.waitFor({ state: 'visible', timeout: h.budget(this) });
    await box.locator('input[placeholder="Search for users"]').fill(who).catch(() => {});
    await box.locator('.user-list-item').filter({ has: page.locator('.user-list-name', { hasText: h.exactly(who) }) }).first().click({ timeout: h.budget(this) });
    const add = box.locator('button, a.button, .btn-big').filter({ hasText: /^\s*Add\s*$/i }).first();
    if (await add.isVisible().catch(() => false)) await add.click({ timeout: h.budget(this) });
    await box.waitFor({ state: 'hidden', timeout: h.budget(this) });
  }, 'Add assigned is in the sidebar, under Assigned; it lists the project\'s members by their full names. A reader has no Add assigned.');
  const shown = await h.waitForValue(() => assignedShown(this), (s) => new RegExp(h.words(who), 'i').test(s), h.budget(this));
  if (!shown.ok) throw friendly({ message: `${who} is not among the user story's assigned users; the page shows "${shown.value}".`, hint: 'Name a member of the project by the full name the site shows.' });
});

/**
 * One of the open user story's assigned users, by the full name its page shows.
 *
 * Example #1: Then the user story should be assigned to "Member Test"
 * Example #2: Then the user story should be assigned to "Owner Test"
 * Example #3: And the user story should be assigned to "Member Test"
 * Example #4: But the user story should be assigned to "Owner Test"
 * Example #5: Given the user story should be assigned to "Member Test"
 */
Then(/^the user story should be assigned to "([^"]*)"$/, async function (who) {
  h.openStory(this);
  const shown = await h.waitForValue(() => assignedShown(this), (s) => new RegExp(h.words(who), 'i').test(s), h.budget(this));
  if (!shown.ok) throw friendly({ message: `Expected ${who} among the user story's assigned users, but the page shows "${shown.value || 'none'}".`, hint: 'The assigned users are in the sidebar, under Assigned.' });
});

/**
 * Who made the open user story, as its page says it ("Created by …").
 *
 * Example #1: Then the user story should be created by "Owner Test"
 * Example #2: Then the user story should be created by "Member Test"
 * Example #3: And the user story should be created by "Owner Test"
 * Example #4: But the user story should be created by "Member Test"
 * Example #5: Given the user story should be created by "Owner Test"
 */
Then(/^the user story should be created by "([^"]*)"$/, async function (who) {
  h.openStory(this);
  const by = this.page.locator('.ticket-created-by .created-title').filter({ hasText: new RegExp('Created by\\s+' + h.words(who) + '\\s*$', 'i') });
  await h.assertPresence(by, null, { label: `"Created by ${who}"`, hint: 'The page says who made the user story beside its subject.', timeout: h.budget(this) });
});

/**
 * A task of the open user story, as its page lists it under Tasks.
 *
 * Example #1: Then the user story should have the task "Fix the spelling in greeting.sh"
 * Example #2: Then the user story should have the task "Fix the spelling in greeting.sh"
 * Example #3: And the user story should have the task "Fix the spelling in greeting.sh"
 * Example #4: But the user story should have the task "Fix the spelling in greeting.sh"
 * Example #5: Given the user story should have the task "Fix the spelling in greeting.sh"
 */
Then(/^the user story should have the task "([^"]*)"$/, async function (task) {
  h.openStory(this);
  const shown = this.page.locator('.related-tasks-body').filter({ hasText: new RegExp(h.words(task), 'i') });
  await h.assertPresence(shown, null, { label: `the task "${task}"`, hint: 'The tasks of a user story are listed under Tasks, below its description.', timeout: h.budget(this) });
});

/**
 * The open user story offers the session nothing to change: no status menu, no Add tag, no Add assigned, and the
 * site keeps it as it was.
 *
 * Example #1: Then I should not be able to change the user story
 * Example #2: Then we should not be able to change the user story
 * Example #3: And I should not be able to change the user story
 * Example #4: But we should not be able to change the user story
 * Example #5: Given I should not be able to change the user story
 */
Then(/^(I |we )*should not be able to change the user story$/, async function (_who) {
  h.openStory(this);
  const page = this.page;
  await page.locator('.detail-title-text').first().waitFor({ state: 'visible', timeout: h.budget(this) });
  const offered = [];
  if (await page.locator('tg-tag-line button[title="Add tag"]').count()) offered.push('Add tag');
  if (await page.getByText('Add assigned', { exact: true }).count()) offered.push('Add assigned');
  await page.locator('.detail-status-inner').first().click({ timeout: 3000 }).catch(() => {});
  if (await page.locator('.detail-status ul li a.status').first().isVisible().catch(() => false)) offered.push('the status menu');
  await page.keyboard.press('Escape').catch(() => {});
  if (offered.length) throw friendly({ message: `Expected nothing to change on the user story, but the page offers ${offered.join(', ')}.`, hint: 'Sign in with a role that only views the project, such as reader.' });
});

/**
 * The open user story offers the session no comment editor.
 *
 * Example #1: Then I should not be able to comment on the user story
 * Example #2: Then we should not be able to comment on the user story
 * Example #3: And I should not be able to comment on the user story
 * Example #4: But we should not be able to comment on the user story
 * Example #5: Given I should not be able to comment on the user story
 */
Then(/^(I |we )*should not be able to comment on the user story$/, async function (_who) {
  h.openStory(this);
  const page = this.page;
  await page.locator('.detail-title-text').first().waitFor({ state: 'visible', timeout: h.budget(this) });
  const editors = page.locator('tg-comments tg-comment-wysiwyg .ck-editor__editable');
  if (await editors.count() && await editors.first().isVisible().catch(() => false)) {
    throw friendly({ message: 'Expected no comment editor on the user story, but the page offers one.', hint: 'Sign in with a role that may not comment, such as reader.' });
  }
});
