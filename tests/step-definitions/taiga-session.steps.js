'use strict';

// Signing in and out, and the session's account.
//
// The site signs in with a username (or an email) and a password on one form (/login), and keeps the session in the
// page's local storage (a JWT of the person); it signs out from the person's menu (their picture, at the top right),
// Logout, which forgets that session. The session's account is the one the site's REST API names for that JWT, so a
// step never guesses it from the page.

const { Given, When, Then, After, AfterAll } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./taiga-helpers');

/**
 * Sign in as an account of the users registry (cucumber.js, worldParameters.users), or keep its session when it is the
 * browser's already.
 *
 * Example #1: Given I am a logged in user with the "member" user
 * Example #2: Given we are a logged in user with the "owner" user
 * Example #3: And I am a logged in user with the "member" user
 * Example #4: And we are a logged in user with the "owner" user
 * Example #5: Given we are a logged in user with the "member" user
 */
Given(/^(I am|we are) a logged in user with the "([^"]*)" user$/, async function (_who, handle) {
  await h.signInAs(this, handle);
});

/**
 * Sign in through the form as an account of the users registry: a new session, whatever the browser held.
 *
 * Example #1: When I log in with the "member" user
 * Example #2: When log in with the "reader" user
 * Example #3: And I log in with the "member" user
 * Example #4: And log in with the "reader" user
 * Example #5: When we log in with the "member" user
 */
When(/^(I |we )*log in with the "([^"]*)" user$/, async function (_who, handle) {
  const user = h.resolveUser(this, handle);
  await h.dropSession(this);
  await h.submitLogin(this, user.username, user.password);
  const result = await h.waitForValue(() => h.currentAccount(this), (me) => h.sessionIs(this, me, user), h.budget(this));
  if (!result.ok) {
    const said = await h.loginSays(this);
    throw friendly({ message: `Signing in as "${handle}" (${user.username}) did not work${said ? `: the site says "${said}"` : ''}.`, hint: 'Check the account\'s username and password in worldParameters.users of cucumber.js.' });
  }
});

/**
 * Sign in through the form with a username and a password that need not be right: the step asserts nothing, a refusal
 * is read by the steps after it.
 *
 * Example #1: When I log in as "member" with the password "not-the-right-password"
 * Example #2: When log in as "nobody" with the password "dD.123123ddd"
 * Example #3: And I log in as "member" with the password "not-the-right-password"
 * Example #4: And log in as "nobody" with the password "dD.123123ddd"
 * Example #5: When we log in as "member" with the password "not-the-right-password"
 */
When(/^(I |we )*log in as "([^"]*)" with the password "([^"]*)"$/, async function (_who, username, password) {
  await h.dropSession(this);
  await h.submitLogin(this, username, password);
});

/**
 * Start without a session: the browser holds none of the site's.
 *
 * Example #1: Given I am not logged in
 * Example #2: Given we are not logged in
 * Example #3: And I am not logged in
 * Example #4: And we are not logged in
 * Example #5: When I am not logged in
 */
Given(/^(I am|we are) not logged in$/, async function (_who) {
  await h.dropSession(this);
});

/**
 * Sign out, the way the site does it (the person's menu, their picture at the top right, then Logout), and wait until
 * the session is gone.
 *
 * Example #1: When I log out
 * Example #2: When we log out
 * Example #3: And I log out
 * Example #4: And we log out
 * Example #5: Then I log out
 */
When(/^(I |we )*log out$/, async function (_who) {
  const me = await h.currentAccount(this);
  if (!me) throw friendly({ message: 'There is no session to sign out of.', hint: 'Sign in first.' });
  const page = this.page;
  if (!h.onSite(this) || /\/(login|conf\.json)/.test(page.url())) await h.open(this, '/');
  await h.actOrExplain('sign out', 'the person\'s menu', async () => {
    const logout = page.locator('.navbar-dropdown a, .dropdown-user a, nav a').filter({ hasText: /^\s*Logout\s*$/ }).first();
    await page.locator('.user-avatar, .topnav-dropdown-wrapper .user-avatar').first().hover({ timeout: h.budget(this) });
    if (!(await logout.isVisible().catch(() => false))) await page.locator('.user-avatar').first().click({ timeout: h.budget(this) });
    await logout.click({ timeout: h.budget(this) });
  }, 'The site signs out from the person\'s menu (their picture, at the top right), Logout.');
  const gone = await h.waitForValue(() => h.currentUser(this), (u) => u === '', h.budget(this));
  if (!gone.ok) throw friendly({ message: `Signing out did not end the session of ${gone.value}.`, hint: 'The site signs out from the person\'s menu, Logout.' });
});

/**
 * The browser's session is an account's: its full name as the site shows it, or its username.
 *
 * Example #1: Then I should be logged in as "Member Test"
 * Example #2: Then I should be logged in as "member"
 * Example #3: And I should be logged in as "Member Test"
 * Example #4: But I should be logged in as "member"
 * Example #5: Then we should be logged in as "Member Test"
 */
Then(/^(I |we )*should be logged in as "([^"]*)"$/, async function (_who, who) {
  const wanted = String(who).trim().toLowerCase();
  const result = await h.waitForValue(() => h.currentAccount(this), (me) => !!me && (me.name.toLowerCase() === wanted || me.username.toLowerCase() === wanted), h.budget(this));
  if (!result.ok) {
    const me = result.value;
    throw friendly({ message: `Expected to be logged in as "${who}", but ${me ? `the session is ${me.name} (${me.username})` : 'there is no session'}.`, hint: 'Name the account by its full name, as the site shows it, or by its username.' });
  }
});

/**
 * The browser holds no session of the site's.
 *
 * Example #1: Then I should not be logged in
 * Example #2: Then we should not be logged in
 * Example #3: And I should not be logged in
 * Example #4: But we should not be logged in
 * Example #5: Given I should not be logged in
 */
Then(/^(I |we )*should not be logged in$/, async function (_who) {
  const result = await h.waitForValue(() => h.currentUser(this), (u) => u === '', h.budget(this));
  if (!result.ok) throw friendly({ message: `Expected no session, but the session is ${result.value}'s.`, hint: 'Sign out first, or start with Given I am not logged in.' });
});

/**
 * The sign-in form stayed, with the site's message: the account was refused.
 *
 * Example #1: Then the login should be refused with "your username/email or password are incorrect"
 * Example #2: Then the login should be refused with "Oops, something went wrong"
 * Example #3: And the login should be refused with "your username/email or password are incorrect"
 * Example #4: But the login should be refused with "Oops, something went wrong"
 * Example #5: Given the login should be refused with "your username/email or password are incorrect"
 */
Then(/^the login should be refused with "([^"]*)"$/, async function (message) {
  const page = this.page;
  await h.assertPresence(page.locator('input[name="password"]'), null, { label: 'the sign-in form', hint: 'A refused sign-in stays on the form, at /login.', timeout: h.budget(this) });
  const said = page.locator('.notification-message-light-error').filter({ hasText: new RegExp(h.words(message), 'i') }).first();
  await h.assertPresence(said, null, { label: `the message "${message}"`, hint: 'The site says the same for a wrong password and for an account it does not have: "Oops, something went wrong... your username/email or password are incorrect." It locks no account after failures.', timeout: h.budget(this) });
  if (await h.sessionToken(this)) throw friendly({ message: 'The sign-in was refused, yet the browser holds a session.', hint: 'Start with Given I am not logged in.' });
});

/**
 * A page of the site sends a visitor to the sign-in form, and back to the page after signing in.
 *
 * Example #1: Then I should be sent to the login form
 * Example #2: Then we should be sent to the login form
 * Example #3: And I should be sent to the login form
 * Example #4: But we should be sent to the login form
 * Example #5: Given I should be sent to the login form
 */
Then(/^(I |we )*should be sent to the login form$/, async function (_who) {
  const page = this.page;
  const ok = await h.waitForValue(async () => new URL(page.url()).pathname, (p) => p === '/login', h.budget(this));
  if (!ok.ok) throw friendly({ message: `Expected the sign-in form, but the page is ${page.url()}.`, hint: 'A visitor who opens a page of a private project is sent to /login, with the page to come back to.' });
  await h.assertPresence(page.locator('input[name="password"]'), null, { label: 'the sign-in form', hint: 'The sign-in form asks for a username or email and a password.', timeout: h.budget(this) });
});

// A scenario's user stories go after it, as the managing account: the ones it made through the API, and the ones it
// gave a subject through the site's screens. A run leaves the site as it found it.
After(async function () {
  const s = this.taiga || {};
  const ids = new Set(s.made || []);
  for (const [projectName, subject] of s.subjects || []) {
    try {
      const project = await h.findProject(this, projectName);
      for (const us of await h.findStories(this, project, subject)) ids.add(Number(us.id));
    } catch (e) {
      console.warn(`[taiga-steps] the user story "${subject}" the scenario made could not be found: ${h.tidy(e && e.message).slice(0, 300)}`);
    }
  }
  for (const id of ids) {
    await h.removeStory(this, id).catch((e) => console.warn(`[taiga-steps] the user story ${id} the scenario made could not be removed: ${h.tidy(e && e.message).slice(0, 300)}`));
  }
  if (s.made) s.made.clear();
  s.subjects = [];
});

// The run's API clients end with it.
AfterAll(async function () {
  await h.managerContexts.dispose();
});
