'use strict';

// Shared helpers for the step files of this pack.
//
// Not a step file: it registers no step definitions and no hooks. It holds the plumbing the steps use and that
// another pack can require instead of copying: the wait budget, presence assertions with friendly errors, URL
// building, the users registry, signing in (the form, and a session put back: its keys in the page's storage), the
// site's own REST API as the managing account (the test content a scenario makes and removes), its projects, sprints
// and user stories, and the user stories a scenario made, which go after it.
//
// The site keeps a browser's session in the page's local storage (`token`, a JWT of the person, `refresh` and
// `userInfo`); the steps read who the session is by asking the site's REST API with that token. The site has no way to
// end a session through its API: signing out forgets it in the browser, and its tokens expire as the site sets them
// (a day for the session, eight days for its refresh).
//
// Everything here builds on webship-js's own helpers (`gotoUrl`, `smartSettle`, `waitForPageLoad`, `friendly`) so the
// steps behave like the core webship-js steps.

const { gotoUrl, smartSettle, waitForPageLoad, friendly } = require('webship-js/tests/step-definitions/webship');

let playwright;
try { playwright = require('playwright'); } catch { playwright = require(require.resolve('playwright', { paths: [require.resolve('webship-js/package.json')] })); }

/** The keys the site keeps a browser's session under, in the page's local storage. */
const SESSION_KEYS = ['token', 'refresh', 'userInfo'];

/**
 * The per-assertion wait budget: `minWaitTime.page` from cucumber.js, at least 15 seconds (the site draws its screens
 * after the page has loaded), so a slow screen does not fail an assertion that would pass a moment later. Kept below
 * webship-js's 45 second step timeout.
 *
 * @param {object} world
 * @returns {number}
 */
function budget(world) {
  return Math.max((world && world.minWaitTime && world.minWaitTime.page) || 0, 15000);
}

/**
 * Escape a literal string for use in a RegExp.
 *
 * @param {string} text
 * @returns {string}
 */
function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The source of a pattern for a text whose words may stand apart by any white space: a pattern of a locator tests the
 * element's whole text, where the site's markup can put two spaces or a line break between words.
 *
 * @param {string} text
 * @returns {string}
 */
function words(text) {
  return escapeRegExp(String(text).trim()).replace(/\s+/g, '\\s+');
}

/**
 * A RegExp that matches the whole text (ignoring surrounding space and case), for exact names and titles.
 *
 * @param {string} text
 * @returns {RegExp}
 */
function exactly(text) {
  return new RegExp('^\\s*' + words(text) + '\\s*$', 'i');
}

/**
 * Collapse runs of white space and trim.
 *
 * @param {string} text
 * @returns {string}
 */
function tidy(text) {
  return String(text === null || text === undefined ? '' : text).replace(/\s+/g, ' ').trim();
}

/**
 * Run an action and rethrow its failure as a friendly error (action, target, cause and a hint) instead of
 * Playwright's raw timeout stack.
 *
 * @param {string} label
 * @param {string} target
 * @param {Function} fn
 * @param {string} hint
 */
async function actOrExplain(label, target, fn, hint) {
  try {
    return await fn();
  } catch (err) {
    if (err && err.stack === err.message && /Hint:/.test(err.message)) throw err;
    throw friendly({ action: label, target, cause: err, hint });
  }
}

/**
 * Wait until a locator has (or, with `notCase`, no longer has) a visible match and fail with a friendly error
 * otherwise: the wait and the assertion are one call, so content that arrives a moment late still passes.
 *
 * @param {import('playwright').Locator} locator
 * @param {string|null|undefined} notCase
 * @param {{label: string, hint: string, timeout: number}} options
 */
async function assertPresence(locator, notCase, { label, hint, timeout }) {
  try {
    await locator.first().waitFor({ state: notCase ? 'hidden' : 'visible', timeout });
  } catch {
    throw friendly({
      message: notCase ? `Expected not to see ${label}, but it is still on the page.` : `Expected to see ${label}, but it did not appear within ${timeout} ms.`,
      hint,
    });
  }
}

/**
 * Poll a reader until its value satisfies a test, and return the last value read, so a value that changes a moment
 * after the action (a user story's status after a change) still passes.
 *
 * @param {Function} read - async () => value
 * @param {Function} test - (value) => boolean
 * @param {number} timeout
 * @param {number} [every] - milliseconds between two reads
 * @returns {Promise<{ok: boolean, value: *}>}
 */
async function waitForValue(read, test, timeout, every = 500) {
  const deadline = Date.now() + timeout;
  let value;
  for (;;) {
    try { value = await read(); } catch { value = undefined; }
    if (value !== undefined && test(value)) return { ok: true, value };
    if (Date.now() >= deadline) return { ok: false, value };
    await new Promise((resolve) => setTimeout(resolve, every));
  }
}

/**
 * The site root without a trailing slash.
 *
 * @param {object} world
 * @returns {string}
 */
function siteRoot(world) {
  return String(world.launchUrl).replace(/\/+$/, '');
}

/**
 * Join the site root and a path with exactly one slash. Absolute URLs pass through.
 *
 * @param {object} world
 * @param {string} url
 * @returns {string}
 */
function siteUrl(world, url) {
  if (!url) return siteRoot(world);
  if (/^https?:\/\//i.test(url)) return url;
  return siteRoot(world) + '/' + String(url).replace(/^\/+/, '');
}

/** The scenario's own state of this pack. */
function state(world) {
  world.taiga = world.taiga || {};
  return world.taiga;
}

/** Whether the page is on the site (its storage is the site's). */
function onSite(world) {
  try { return new URL(world.page.url()).origin === new URL(siteRoot(world)).origin; } catch { return false; }
}

/**
 * Put the page on the site without drawing it: the front end's own configuration file, so the site's storage can be
 * read and written before a screen is opened.
 *
 * @param {object} world
 */
async function onSiteQuietly(world) {
  if (onSite(world)) return;
  await world.page.goto(siteUrl(world, '/conf.json'), { waitUntil: 'domcontentloaded', timeout: budget(world) * 2 });
}

/**
 * The session the page's storage holds: its keys and their values, or null.
 *
 * @param {object} world
 * @returns {Promise<Object<string, string>|null>}
 */
async function storedSession(world) {
  if (!onSite(world)) return null;
  const kept = await world.page.evaluate((keys) => Object.fromEntries(keys.map((k) => [k, window.localStorage.getItem(k)])), SESSION_KEYS).catch(() => null);
  return kept && kept.token ? kept : null;
}

/**
 * The person's JWT of the browser's session, or ''.
 *
 * @param {object} world
 * @returns {Promise<string>}
 */
async function sessionToken(world) {
  const kept = await storedSession(world);
  if (!kept) return '';
  try { return String(JSON.parse(kept.token) || ''); } catch { return ''; }
}

/**
 * Open a page of the site and wait until its screen is drawn: the site is one page that draws each screen once its
 * scripts have run, and shows "Loading..." until then.
 *
 * @param {object} world
 * @param {string} url
 */
async function open(world, url) {
  const target = siteUrl(world, url);
  await world.page.goto(target, { waitUntil: 'domcontentloaded', timeout: budget(world) * 2 });
  await waitForPageLoad(world.page, (world.minWaitTime && world.minWaitTime.page) || 3000);
  await world.page.waitForFunction(() => {
    const main = document.querySelector('.master, tg-main, .main, body');
    const text = (main && main.innerText) || '';
    return text.trim() !== '' && !/^\s*Loading\.\.\.\s*$/.test(text);
  }, null, { timeout: budget(world) }).catch(() => {});
}

/**
 * A user of the `users` registry in cucumber.js (`worldParameters.users`): the username the site signs in with
 * (`username`), its password, and the name the site shows (`name`).
 *
 * @param {object} world
 * @param {string} handle
 * @returns {{username: string, password: string, name: string}}
 */
function resolveUser(world, handle) {
  const users = (world.parameters && world.parameters.users) || {};
  const entry = users[handle];
  if (!entry) {
    throw friendly({
      message: `The account "${handle}" is not in the users registry. Known accounts: ${Object.keys(users).join(', ') || '(none)'}.`,
      hint: `Add it to worldParameters.users in cucumber.js: users: { ${handle}: { username: '${handle}', password: process.env.TAIGA_${handle.toUpperCase()}_PASSWORD, name: '${handle}' } }. The account itself is made once by the build of the site, never by a feature.`,
    });
  }
  if (!entry.password) {
    throw friendly({ message: `The account "${handle}" has no password in the users registry.`, hint: `Set TAIGA_${handle.toUpperCase()}_PASSWORD, or the password in worldParameters.users of cucumber.js.` });
  }
  return { username: String(entry.username || handle), password: String(entry.password), name: String(entry.name || entry.username || handle) };
}

// ---------------------------------------------------------------------------
// The site's REST API: the run's own client, apart from the browser
// ---------------------------------------------------------------------------

const apiContexts = new Map();

/** The run's own client of the site's REST API, apart from the browser and its storage. */
async function apiContext(world) {
  const root = siteRoot(world);
  if (!apiContexts.has(root)) apiContexts.set(root, await playwright.request.newContext({ ignoreHTTPSErrors: true }));
  return apiContexts.get(root);
}

/**
 * One call of the site's REST API (/api/v1…) with a person's JWT: [status, answer].
 *
 * @param {object} world
 * @param {string} method
 * @param {string} route - "/users/me"
 * @param {object|undefined} body
 * @param {string} token
 * @returns {Promise<[number, *]>}
 */
async function rest(world, method, route, body, token) {
  const request = await apiContext(world);
  const r = await request.fetch(siteUrl(world, '/api/v1' + route), {
    method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { data: JSON.stringify(body) }),
    failOnStatusCode: false,
  });
  let answer = null;
  try { answer = await r.json(); } catch { answer = null; }
  return [r.status(), answer];
}

/** What an answer of the site says went wrong, in one line. */
function saidOf(answer) {
  if (!answer || typeof answer !== 'object') return '';
  const said = answer._error_message || answer.detail || Object.entries(answer).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : typeof v === 'string' ? v : JSON.stringify(v)}`).join('; ');
  return tidy(said).slice(0, 300);
}

/**
 * The account of the browser's session, as the site's REST API names it for its JWT: { name, username } or null.
 *
 * @param {object} world
 * @returns {Promise<{name: string, username: string}|null>}
 */
async function currentAccount(world) {
  const token = await sessionToken(world);
  if (!token) return null;
  const [status, me] = await rest(world, 'GET', '/users/me', undefined, token);
  if (status !== 200 || !me || !me.username) return null;
  return { name: String(me.full_name_display || me.username), username: String(me.username) };
}

/** Whether the session is an account of the registry's, by its name or its username. */
function sessionIs(world, account, user) {
  if (!account) return false;
  const name = account.name.toLowerCase();
  return name === user.name.toLowerCase() || account.username.toLowerCase() === user.username.toLowerCase();
}

/** The name of the browser's session, or '' for none. */
async function currentUser(world) {
  const me = await currentAccount(world);
  return me ? me.name : '';
}

/** The browser forgets its session: the keys of the page's storage, as signing out does. */
async function dropSession(world) {
  await onSiteQuietly(world);
  await world.page.evaluate((keys) => { for (const k of keys) window.localStorage.removeItem(k); }, SESSION_KEYS).catch(() => {});
}

/** Fill and submit the sign-in form: the username, the password, Login. */
async function submitLogin(world, username, password) {
  await open(world, '/login');
  const page = world.page;
  await page.locator('input[name="username"]').waitFor({ state: 'visible', timeout: budget(world) });
  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('form button[type="submit"]').first().click();
}

/** What the sign-in form says, or ''. */
async function loginSays(world) {
  return tidy(await world.page.locator('.notification-message-light-error:not(.inactive)').first().innerText({ timeout: 1500 }).catch(() => ''));
}

const sessions = new Map();

/**
 * Sign in with an account of the users registry and make sure the session is that account's. An account that is
 * already signed in is kept; an account that signed in earlier in the run gets its session back (its keys in the
 * page's storage); otherwise the account goes through the sign-in form.
 *
 * @param {object} world
 * @param {string} handle
 */
async function signInAs(world, handle) {
  const user = resolveUser(world, handle);
  const key = siteRoot(world) + '|' + handle;
  if (sessionIs(world, await currentAccount(world), user)) return;
  await dropSession(world);
  const saved = sessions.get(key);
  if (saved) {
    await onSiteQuietly(world);
    await world.page.evaluate((kept) => { for (const [k, v] of Object.entries(kept)) if (v !== null) window.localStorage.setItem(k, v); }, saved);
    if (sessionIs(world, await currentAccount(world), user)) return;
    sessions.delete(key);
    await dropSession(world);
  }
  await submitLogin(world, user.username, user.password);
  const result = await waitForValue(() => currentAccount(world), (me) => sessionIs(world, me, user), budget(world));
  if (!result.ok) {
    const said = await loginSays(world);
    throw friendly({
      message: `Signing in as "${handle}" (${user.username}) did not work${said ? `: the site says "${said}"` : `; the page is ${world.page.url()}`}.`,
      hint: 'Check the username and the password of this account in worldParameters.users of cucumber.js, and that the account exists on the site and may sign in.',
    });
  }
  sessions.set(key, await storedSession(world));
}

// ---------------------------------------------------------------------------
// The site's REST API, as the managing account
// ---------------------------------------------------------------------------

const managers = new Map();

/**
 * The managing account's session (worldParameters.manager: the administrator of the projects the features use),
 * signed in once a run through the site's REST API: { id, token, handle }.
 *
 * @param {object} world
 */
async function manager(world) {
  const handle = (world.parameters && world.parameters.manager) || 'owner';
  const key = siteRoot(world) + '|' + handle;
  if (managers.has(key)) return managers.get(key);
  const user = resolveUser(world, handle);
  const [status, answer] = await rest(world, 'POST', '/auth', { type: 'normal', username: user.username, password: user.password });
  if (status !== 200 || !answer || !answer.auth_token) {
    throw friendly({ message: `The managing account "${handle}" could not sign in to the site's API (${status}${saidOf(answer) ? `: ${saidOf(answer)}` : ''}).`, hint: 'worldParameters.manager names an account of the users registry: the administrator of the projects the features use, with its username and password.' });
  }
  const m = { id: Number(answer.id), token: String(answer.auth_token), handle };
  managers.set(key, m);
  return m;
}

/**
 * One call of the site's REST API as the managing account: its answer, or a friendly error that says what was asked.
 *
 * @param {object} world
 * @param {string} method
 * @param {string} route
 * @param {object|undefined} body
 * @param {string} what - what the call does, for the error ("make the user story …")
 * @returns {Promise<*>}
 */
async function api(world, method, route, body, what) {
  const m = await manager(world);
  const [status, answer] = await rest(world, method, route, body, m.token);
  if (status < 200 || status >= 300) {
    throw friendly({
      message: `Could not ${what}: the site answered ${status}${saidOf(answer) ? ` (${saidOf(answer)})` : ''}.`,
      hint: 'The managing account (worldParameters.manager) must administer the projects the features use.',
    });
  }
  return answer;
}

/** The run's API clients, and their end. */
const managerContexts = {
  async dispose() {
    managers.clear();
    sessions.clear();
    for (const c of apiContexts.values()) await c.dispose().catch(() => {});
    apiContexts.clear();
  },
};

// ---------------------------------------------------------------------------
// Projects, sprints and user stories
// ---------------------------------------------------------------------------

/** A project of the site by its name (or its slug), as the managing account sees it: { id, slug, name, statuses }. */
async function findProject(world, which) {
  const wanted = String(which || (world.parameters && world.parameters.project) || '').trim();
  const m = await manager(world);
  const projects = await api(world, 'GET', `/projects?member=${m.id}&page_size=100`, undefined, 'read the projects');
  const hit = (Array.isArray(projects) ? projects : []).find((p) => p && (exactly(wanted).test(String(p.name)) || String(p.slug) === wanted));
  if (!hit) throw friendly({ message: `No project "${wanted}" the managing account is a member of.`, hint: 'Name the project by its name, as the site lists it ("Webship site").' });
  const detail = await api(world, 'GET', `/projects/${hit.id}`, undefined, `read the project ${hit.name}`);
  return {
    id: Number(hit.id), slug: String(hit.slug), name: String(hit.name),
    statuses: (Array.isArray(detail && detail.us_statuses) ? detail.us_statuses : []).map((s) => ({ id: Number(s.id), name: String(s.name) })),
  };
}

/** A sprint of a project by its name: { id, slug, name }. */
async function findSprint(world, project, name) {
  const sprints = await api(world, 'GET', `/milestones?project=${project.id}&page_size=100`, undefined, `read the sprints of ${project.name}`);
  const hit = (Array.isArray(sprints) ? sprints : []).find((s) => s && exactly(name).test(String(s.name)));
  if (!hit) throw friendly({ message: `The project "${project.name}" has no sprint "${name}".`, hint: 'Name the sprint as the backlog shows it ("Sprint 1").' });
  return { id: Number(hit.id), slug: String(hit.slug), name: String(hit.name) };
}

/** The user stories of a project with a subject: Taiga's own text filter, then the whole subject. */
async function findStories(world, project, subject) {
  const rows = await api(world, 'GET', `/userstories?project=${project.id}&q=${encodeURIComponent(subject)}&page_size=100`, undefined, `look for the user story "${subject}"`);
  return (Array.isArray(rows) ? rows : []).filter((us) => us && exactly(subject).test(String(us.subject)));
}

/** The one user story of a project with a subject: { id, ref, subject, version, … }, or a friendly error. */
async function storyNamed(world, subject, projectName) {
  const project = await findProject(world, projectName);
  const found = await findStories(world, project, subject);
  if (found.length !== 1) {
    throw friendly({
      message: found.length ? `The project "${project.name}" has ${found.length} user stories "${subject}".` : `The project "${project.name}" has no user story "${subject}".`,
      hint: found.length ? 'Give each user story of a scenario a subject of its own.' : 'Make it first: Given there is a user story "…" in the project "…".',
    });
  }
  return { project, story: found[0] };
}

/** A user story the scenario made: it is removed after the scenario. */
function remember(world, id) {
  const s = state(world);
  s.made = s.made || new Set();
  s.made.add(Number(id));
}

/** A subject the scenario gave a user story through the site's screens: such user stories are removed after it. */
function rememberSubject(world, projectName, subject) {
  const s = state(world);
  s.subjects = s.subjects || [];
  s.subjects.push([projectName, subject]);
}

/** Remove a user story, as the managing account (its tasks and history go with it). */
async function removeStory(world, id) {
  await api(world, 'DELETE', `/userstories/${id}`, undefined, `remove the user story ${id}`);
}

/**
 * Make a user story in a project, as the managing account, in the status given (else the project's first) and, with
 * a sprint, in that sprint: it is removed after the scenario.
 */
async function makeStory(world, project, subject, { status, sprint } = {}) {
  const body = { project: project.id, subject };
  if (status) {
    const hit = project.statuses.find((s) => exactly(status).test(s.name));
    if (!hit) throw friendly({ message: `The project "${project.name}" has no status "${status}".`, hint: `Its statuses: ${project.statuses.map((s) => s.name).join(', ')}.` });
    body.status = hit.id;
  }
  if (sprint) body.milestone = (await findSprint(world, project, sprint)).id;
  const made = await api(world, 'POST', '/userstories', body, `make the user story "${subject}"`);
  remember(world, made.id);
  return made;
}

/** The open user story's page (the scenario's last), or a friendly error. */
function openStory(world) {
  const s = state(world);
  if (!s.story) throw friendly({ message: 'No user story is open.', hint: 'Open one first: When I open the user story "…".' });
  return s.story;
}

/** Open a user story's page and wait until it is drawn. */
async function showStory(world, project, story) {
  await open(world, `/project/${project.slug}/us/${story.ref}`);
  await world.page.locator('.detail-title-text').first().waitFor({ state: 'visible', timeout: budget(world) });
  state(world).story = { project, id: Number(story.id), ref: Number(story.ref), subject: String(story.subject) };
}

/** The open user story as the site has it now (as the managing account). */
async function storyNow(world) {
  const s = openStory(world);
  return api(world, 'GET', `/userstories/${s.id}`, undefined, `read the user story "${s.subject}"`);
}

/** A column's place among a board's headers (the taskboard's or the Kanban board's): its index, or -1. */
async function columnIndex(world, headers, name) {
  const names = (await headers.allInnerTexts()).map(tidy);
  return names.findIndex((n) => exactly(name).test(n));
}

module.exports = {
  SESSION_KEYS,
  budget,
  escapeRegExp,
  words,
  exactly,
  tidy,
  actOrExplain,
  assertPresence,
  waitForValue,
  siteRoot,
  siteUrl,
  state,
  onSite,
  onSiteQuietly,
  storedSession,
  sessionToken,
  open,
  resolveUser,
  apiContext,
  rest,
  saidOf,
  currentAccount,
  sessionIs,
  currentUser,
  dropSession,
  submitLogin,
  loginSays,
  signInAs,
  manager,
  api,
  managerContexts,
  findProject,
  findSprint,
  findStories,
  storyNamed,
  remember,
  rememberSubject,
  removeStory,
  makeStory,
  openStory,
  showStory,
  storyNow,
  columnIndex,
  gotoUrl,
  smartSettle,
};
