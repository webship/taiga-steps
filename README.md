<p align="center"><img src="https://raw.githubusercontent.com/webship/taiga-steps/2.0.x/assets/logo.png" alt="Taiga logo" width="120"></p>

# taiga-steps

[![Test](https://github.com/webship/taiga-steps/actions/workflows/test.yml/badge.svg)](https://github.com/webship/taiga-steps/actions/workflows/test.yml)

Cucumber step definitions for testing Taiga, the open-source agile project management platform, with
[webship-js](https://webship.co/docs/webship-js/2.0.x), a BDD browser automation harness built on Playwright and
Cucumber-js. The pack covers what a Scrum project's work goes through:

- **signing in and out**: an account of the users registry by its handle, the sign-in form, a refused sign-in, who
  the session is, signing out, and a visitor sent to the sign-in form;
- **the backlog**: the user stories not planned yet, each open sprint with its own beside them, and a new user story
  added the way a person does;
- **one user story** on its page: its status, a comment, a tag, its assigned users, who made it and its tasks, each
  through its own control;
- **the taskboard of a sprint** (its user stories, and their tasks in the column of their status), **the Kanban board**
  (each user story in the column of its status) and **the project's search**;
- **what an account may not do**: a reader of the project neither changes a user story, nor comments on it, nor adds
  one, and an account the project does not have is told it is not found.

The steps make and remove their test content through the site's own REST API, as a managing account (the project's
administrator) with its username and password, apart from the browser: a user story a scenario makes, or gives a
subject through the site's screens, goes after it, so a run leaves the site as it found it.

No step phrase names the platform: a scenario reads `When I change the status of the user story to "Ready"` and
`Then the column "Done" should show the user story "Add a test for the greeting"`.

CI builds a real Taiga site with [DDEV](https://ddev.com) on the runner (Taiga's own images as its reference setup runs
them, on the project's own PostgreSQL 12, the accounts of the suite in their roles of the sample project, the sample
content), runs the whole suite against it twice on every push and pull request, checks after each run that the site
holds what it held before, then runs the assertions that must fail; see [The test site](#the-test-site) and
[`.github/workflows/test.yml`](.github/workflows/test.yml).

## Signing in first

Every feature starts by signing in: an account of the users registry, by its handle.

| Step | What it does |
| --- | --- |
| `Given I am a logged in user with the "member" user` | Signs in as an account of the users registry, by its handle. The first time in a run through the sign-in form, then its session is put back |
| `When I log in with the "member" user` | Fills and submits the sign-in form with the account's username and password, and waits until the session is the account's |
| `When I log in as "member" with the password "wrong"` | Fills and submits the sign-in form with a username and a password as typed, and asserts nothing: for scenarios about the sign-in itself |
| `Given I am not logged in` | The browser forgets its session |
| `When I log out` | Signs out from the person's menu (their picture, at the top right), Logout, and waits until the session is gone |
| `Then I should be logged in as "Member Test"` | The session is the account's: its full name as the site shows it, or its username |
| `Then I should not be logged in` | The browser holds no session |
| `Then the login should be refused with "your username/email or password are incorrect"` | The sign-in form stayed, with that message, and the browser holds no session. The site says the same for a wrong password and for an account it does not have |
| `Then I should be sent to the login form` | A visitor who opens a page of a private project is sent to the sign-in form |

```gherkin
Scenario: An account signs in through the form and out again
  Given I am not logged in
  When I log in with the "member" user
  Then I should be logged in as "Member Test"
  When I log out
  Then I should not be logged in
```

The site keeps a session in the page's local storage (`token`, a JWT of the person, with `refresh` and `userInfo`):
the steps ask the site's REST API who the session is with it, and put an account's session back (those keys) after
its first sign-in. The site has no way to end a session through its API: signing out forgets it in the browser, and
its tokens expire as the site sets them (a day for the session, eight days for its refresh).

## From nothing to a green run

What the machine needs: Docker, [DDEV](https://ddev.com), git, python3, Node.js 24 or later with npm, and about 2 GB of
free memory for Taiga's services and PostgreSQL. Taiga runs in DDEV's containers.

**1. The site.** The pack's own build script (the one CI runs) makes the site in a DDEV project: Taiga's own images as
its reference setup runs them (`taigaio/taiga-back:6.10.2` and its Celery worker, `taigaio/taiga-front:6.10.3`,
`taigaio/taiga-events:6.10.0`, `taigaio/taiga-protected:6.10.1`, the nginx gateway `nginx:1.19.10-alpine` and the two
RabbitMQ `rabbitmq:3.8.34-management-alpine`), on the project's own PostgreSQL 12, an administrator of this site, the
four accounts of [Test users](#test-users), and the sample content (see [The test site](#the-test-site)). It takes
about a minute and a half once the images are pulled (a download of about 1.3 GB the first time).

```bash
git clone https://github.com/webship/taiga-steps.git
SITE_DIR="$PWD/taiga-site" taiga-steps/.github/scripts/build-ddev-site.sh
```

The site answers at `https://taigasteps.ddev.site`. In the [Webship Workspace](https://github.com/webship/workspace),
its Taiga plugin builds the same site in a sites folder, on DDEV, and wires this pack into the testing setup of the
site:

```bash
bash core/scripts/plugins.sh --require @webship.co/workspace-taiga
bash core/scripts/plugins.sh --activate taiga --with-needs
bash core/scripts/plugins.sh --install taiga --with-needs
bash dev/cmd-taiga-project.sh tgsite --install --add-users --sample-content
bash dev/cmd-tools-testing.sh tgsite --run
```

**2. A test project.**

```bash
mkdir taiga-tests && cd taiga-tests
npm init -y
npm install --save-dev webship-js @webship-js/taiga-steps
npx init-webship-js
```

**3. `cucumber.js`.** Add the pack's step definitions after webship-js's own, and give the world its parameters:

```javascript
require: [
  'node_modules/webship-js/tests/step-definitions/**/*.js',
  'node_modules/@webship-js/taiga-steps/tests/step-definitions/**/*.js',
],
tags: process.env.CUCUMBER_TAGS || 'not @wip and not @must-fail',
worldParameters: {
  launchUrl: process.env.LAUNCH_URL || 'https://taigasteps.ddev.site',
  // The account that makes and removes test content through the site's API: the administrator of the projects used.
  manager: process.env.MANAGER || 'owner',
  // The project a step works in when it names none (its name).
  project: process.env.PROJECT || 'Webship site',
  // The site signs in with the username, and shows the full name.
  users: {
    owner: { username: process.env.TAIGA_OWNER_USER || 'owner', password: process.env.TAIGA_OWNER_PASSWORD, name: 'Owner Test' },
    member: { username: process.env.TAIGA_MEMBER_USER || 'member', password: process.env.TAIGA_MEMBER_PASSWORD, name: 'Member Test' },
    reader: { username: process.env.TAIGA_READER_USER || 'reader', password: process.env.TAIGA_READER_PASSWORD, name: 'Reader Test' },
    stranger: { username: process.env.TAIGA_STRANGER_USER || 'stranger', password: process.env.TAIGA_STRANGER_PASSWORD, name: 'Stranger Test' },
  },
  // … webship-js's own parameters (minWaitTime, screenshot, javascript …)
},
```

This repository's own [`cucumber.js`](cucumber.js) is a whole example.

**4. Run.**

```bash
npx cucumber-js                                  # every feature
npx cucumber-js tests/features/stories.feature   # one feature
CUCUMBER_TAGS=@backlog npx cucumber-js           # one tag
```

## Steps

### The backlog and its sprints

| Step | What it does |
| --- | --- |
| `When I open the backlog of the project "Webship site"` | Opens a project's backlog, by the project's name |
| `Then the backlog should show the user story "…"` | A user story among the ones not planned yet (`should not show` for the opposite) |
| `Then the sprint "Sprint 1" should show the user story "…"` | A user story in an open sprint, beside the backlog (`should not show` for the opposite) |
| `When I add the user story "Webship test new" to the backlog` | "+ User story" above the backlog, its subject, Create; waits until the backlog lists it. It goes after the scenario |

### Test content

| Step | What it does |
| --- | --- |
| `Given there is a user story "Webship test work" in the project "Webship site"` | Makes a user story through the site's API, as the managing account, in the project's first status; it goes after the scenario |
| `Given there is a user story "…" with the status "Ready" in the project "…"` | The same, in a status of the project |
| `Given there is a user story "…" in the sprint "Sprint 1" of the project "…"` | The same, in a sprint of the project |
| `Given there is no user story "Webship test new" in the project "Webship site"` | Removes the user stories of that subject a stopped run left, as the managing account |

### One user story

| Step | What it does |
| --- | --- |
| `When I open the user story "…"` | Opens a user story's page, by its subject, in the scenario's project |
| `When I change the status of the user story to "Ready"` | Its status menu, the status; waits until the page shows it |
| `Then the user story should have the status "Ready"` | The page shows that status, and the site keeps it |
| `When I add the comment "…" to the user story` | Writes in its comment editor, waits until the site has the whole text, Save; waits until the comment is on the page |
| `Then the user story should show the comment "…"` | A comment on the page (`… by "Member Test"`: with its author's full name) |
| `When I add the tag "bug" to the user story` | Add tag, the tag's name: a tag the project has is picked from the list under the field, a new one added with the field's Add |
| `Then the user story should have the tag "bug"` | A tag under the subject (`should not have` for the opposite) |
| `When I assign the user story to "Member Test"` | Add assigned, the person in the list of the project's members; waits until the page lists them under Assigned |
| `Then the user story should be assigned to "Member Test"` | One of its assigned users, by full name |
| `Then the user story should be created by "Owner Test"` | The page's "Created by …" |
| `Then the user story should have the task "…"` | A task under Tasks |

### The taskboard, the Kanban board and the search

| Step | What it does |
| --- | --- |
| `When I open the taskboard of the sprint "Sprint 1" of the project "Webship site"` | Opens a sprint's taskboard |
| `Then the taskboard should show the user story "…"` | A row of the taskboard (`should not show` for the opposite) |
| `Then the taskboard should show the task "…" in the column "New"` | A task in the column of its status, in its user story's row |
| `When I open the kanban board of the project "Webship site"` | Opens a project's Kanban board |
| `Then the column "In progress" should show the user story "…"` | A user story in the column of its status (`should not show` for the opposite) |
| `When I search the project "Webship site" for "greting"` | Opens the project's search with those words |
| `Then the search should show the user story "…"` | A user story the search found (`should not show` for the opposite) |

### What an account may not do

| Step | What it does |
| --- | --- |
| `Then I should not be able to change the user story` | The open user story's page offers no status menu, no Add tag and no Add assigned (a reader's) |
| `Then I should not be able to comment on the user story` | The page offers no comment editor (a reader's) |
| `Then I should not be able to add a user story` | The backlog offers no "+ User story" (a reader's) |
| `Then I should be refused the project "Webship site"` | The site says "Not found" (Error 404) for a private project the account is not in (`@js-off`) |

Every step carries five example phrasings in its JSDoc, and `npm run test:examples` checks that each one matches its
own step only.

## Rules of a suite

- Sign in by a handle of the users registry; never write a password into a feature.
- Never create or delete an account in a suite: accounts are configuration, made by the build of the site.
- Change only what the scenario made: a status, a comment, a tag and an assignee go on a user story of
  `Given there is a user story "…"`, which goes after the scenario.
- Name test content "Webship test …". A run that was stopped half way leaves its user stories; the Workspace's
  `cmd-tools-taiga-cli.sh <site> --tidy` deletes them for good (only user stories, tasks and sprints of that title made
  by the test accounts in the sample project, and comments starting "Webship test" on its other user stories), or
  delete them as the managing account.
- Tag with the project's own tags (`bug` in the sample project): a new tag name stays in the project's tags after the
  user story that had it goes.
- A refusal (a project an account may not open) leaves the browser's log with what the site refused: give those
  scenarios `@js-off`.

The site asks for each screen's saved settings of the person (its `user-storage`) and is answered 404 for each one not
saved yet; the browser logs these as `Failed to load resource: … 404`, and webship-js's `javascript.mode` `warn` (the
default of `cucumber.js`) lists them after a scenario without failing it. `WEBSHIP_JS_ERROR_IGNORE` leaves them out.

## Test users

The accounts the features sign in as, each with the password `dD.123123ddd`:

| Handle | Username | Name | Their role in Webship site |
| --- | --- | --- | --- |
| `owner` | `owner` | Owner Test | Its administrator, as Product Owner (the managing account) |
| `member` | `member` | Member Test | A member, as Back: changes user stories |
| `reader` | `reader` | Reader Test | A reader: a role that only views, made by the build (the Scrum template has none) |
| `stranger` | `stranger` | Stranger Test | None: the project does not have them |

The build makes them with Taiga's own code, as the site's administrator: the passwords come on the script's input,
never on a command line.

## The test site

`.github/scripts/build-ddev-site.sh` builds it, and `COUNTS_ONLY=1` makes it print what the site holds (accounts, the
project's memberships and roles, its sprints, user stories, tasks and issues, the comments on its user stories, its
tags): CI compares them before and after each run. The sample content, in the private Scrum project Webship site
(Kanban on too), administered by owner, with member and reader:

- Sprint 1, from three days before the build to eleven days after it;
- #1 "The greeting script says Helo instead of Hello": by the owner, In progress in Sprint 1, assigned to the member,
  tagged bug, with the owner's comment and the member's task #4 "Fix the spelling in greeting.sh";
- #2 "The usage line spells greeting as greting": by the member, New in the backlog;
- #3 "Add a test for the greeting": by the owner, Done in Sprint 1.

The features read the sample content and never change it. The site script (`site/taiga-site.py`), the services
(`site/docker-compose.taiga.yaml`) and the gateway's routes (`site/taiga-gateway.conf`) are the ones of the Webship
Workspace's Taiga plugin: the accounts, the project, its reader role and the memberships are made with Taiga's own
models in its back end's container, and the content through its REST API there, as each part's author.

## The assertions that must fail

`tests/must-fail/` holds scenarios that assert something that is not true on the test site; `npm run test:must-fail`
runs them and checks that each fails at its last step with the message its description announces, and a hint. A step
that cannot fail proves nothing.

## Logo

The logo is Taiga's own icon, `app/images/favicon.png` of taigaio/taiga-front at 6.10.3 (AGPL-3.0), unmodified;
Simple Icons has no Taiga icon. The name and the mark are Taiga's. It names the platform the pack tests.

## License

MIT (see `LICENSE`). Taiga's back end is MPL-2.0 and its front end AGPL-3.0: the pack drives a running site and
carries none of their code.
