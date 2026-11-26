@must-fail
Feature: Assertions that must fail
  Each scenario asserts something that is not true on the test site: its last step must fail with the message its
  description announces, and a hint. The scenarios only read; tests/check-must-fail.js runs them.

  Scenario: A session that is not the account named
    Fails with: Expected to be logged in as "Owner Test", but the session is Member Test (member).
    Given I am a logged in user with the "member" user
    Then I should be logged in as "Owner Test"

  Scenario: A session that is there
    Fails with: Expected no session, but the session is Member Test's.
    Given I am a logged in user with the "member" user
    Then I should not be logged in

  Scenario: A sign-in that worked is not refused
    Fails with: Expected to see the sign-in form, but it did not appear within
    Given I am not logged in
    When I log in with the "member" user
    Then the login should be refused with "your username/email or password are incorrect"

  Scenario: A refusal says what the site says, and nothing else
    Fails with: Expected to see the message "Account locked", but it did not appear within
    Given I am not logged in
    When I log in as "member" with the password "not-the-right-password"
    Then the login should be refused with "Account locked"

  Scenario: A member is not sent to the sign-in form
    Fails with: Expected the sign-in form, but the page is
    Given I am a logged in user with the "member" user
    When I open the backlog of the project "Webship site"
    Then I should be sent to the login form

  Scenario: A user story of the sprint is not in the backlog
    Fails with: Expected to see the user story "The greeting script says Helo instead of Hello" in the backlog, but it did not appear within
    Given I am a logged in user with the "member" user
    When I open the backlog of the project "Webship site"
    Then the backlog should show the user story "The greeting script says Helo instead of Hello"

  Scenario: A user story the backlog shows
    Fails with: Expected not to see the user story "The usage line spells greeting as greting" in the backlog, but it is still on the page.
    Given I am a logged in user with the "member" user
    When I open the backlog of the project "Webship site"
    Then the backlog should not show the user story "The usage line spells greeting as greting"

  Scenario: A user story the sprint does not have
    Fails with: Expected to see the user story "The usage line spells greeting as greting" in the sprint "Sprint 1", but it did not appear within
    Given I am a logged in user with the "member" user
    When I open the backlog of the project "Webship site"
    Then the sprint "Sprint 1" should show the user story "The usage line spells greeting as greting"

  Scenario: A sprint the backlog does not show
    Fails with: Expected to see the sprint "Sprint 9" on the backlog, but it did not appear within
    Given I am a logged in user with the "member" user
    When I open the backlog of the project "Webship site"
    Then the sprint "Sprint 9" should show the user story "The greeting script says Helo instead of Hello"

  Scenario: A member may add a user story
    Fails with: Expected no way to add a user story, but the backlog offers one.
    Given I am a logged in user with the "member" user
    When I open the backlog of the project "Webship site"
    Then I should not be able to add a user story

  Scenario: A status the user story does not have
    Fails with: Expected the user story's status "Done", but its page shows "In progress".
    Given I am a logged in user with the "member" user
    When I open the user story "The greeting script says Helo instead of Hello"
    Then the user story should have the status "Done"

  Scenario: Someone who did not make the user story
    Fails with: Expected to see "Created by Member Test", but it did not appear within
    Given I am a logged in user with the "member" user
    When I open the user story "The greeting script says Helo instead of Hello"
    Then the user story should be created by "Member Test"

  Scenario: Someone the user story is not assigned to
    Fails with: Expected Owner Test among the user story's assigned users, but the page shows "Member Test".
    Given I am a logged in user with the "member" user
    When I open the user story "The greeting script says Helo instead of Hello"
    Then the user story should be assigned to "Owner Test"

  Scenario: A tag the user story has
    Fails with: Expected not to see the tag "bug", but it is still on the page.
    Given I am a logged in user with the "member" user
    When I open the user story "The greeting script says Helo instead of Hello"
    Then the user story should not have the tag "bug"

  Scenario: A task the user story does not have
    Fails with: Expected to see the task "Write the release notes", but it did not appear within
    Given I am a logged in user with the "member" user
    When I open the user story "The greeting script says Helo instead of Hello"
    Then the user story should have the task "Write the release notes"

  Scenario: A comment by someone who did not write it
    Fails with: Expected to see the comment "Seen on the test site: the greeting prints Helo." by Member Test, but it did not appear within
    Given I am a logged in user with the "member" user
    When I open the user story "The greeting script says Helo instead of Hello"
    Then the user story should show the comment "Seen on the test site: the greeting prints Helo." by "Member Test"

  Scenario: A member may change a user story
    Fails with: Expected nothing to change on the user story, but the page offers Add tag, Add assigned, the status menu.
    Given I am a logged in user with the "member" user
    When I open the user story "The usage line spells greeting as greting"
    Then I should not be able to change the user story

  Scenario: A member may comment on a user story
    Fails with: Expected no comment editor on the user story, but the page offers one.
    Given I am a logged in user with the "member" user
    When I open the user story "The usage line spells greeting as greting"
    Then I should not be able to comment on the user story

  Scenario: A user story the sprint's taskboard does not have
    Fails with: Expected to see the user story "The usage line spells greeting as greting" on the taskboard, but it did not appear within
    Given I am a logged in user with the "member" user
    When I open the taskboard of the sprint "Sprint 1" of the project "Webship site"
    Then the taskboard should show the user story "The usage line spells greeting as greting"

  Scenario: A task in a column it is not in
    Fails with: Expected to see the task "Fix the spelling in greeting.sh" in the column "Closed", but it did not appear within
    Given I am a logged in user with the "member" user
    When I open the taskboard of the sprint "Sprint 1" of the project "Webship site"
    Then the taskboard should show the task "Fix the spelling in greeting.sh" in the column "Closed"

  Scenario: A user story in a column it is not in
    Fails with: Expected to see the user story "The greeting script says Helo instead of Hello" in the column "Done", but it did not appear within
    Given I am a logged in user with the "member" user
    When I open the kanban board of the project "Webship site"
    Then the column "Done" should show the user story "The greeting script says Helo instead of Hello"

  Scenario: A column the Kanban board does not have
    Fails with: The Kanban board has no column "Doing".
    Given I am a logged in user with the "member" user
    When I open the kanban board of the project "Webship site"
    Then the column "Doing" should show the user story "The greeting script says Helo instead of Hello"

  Scenario: A user story the search does not find
    Fails with: Expected to see the user story "Add a test for the greeting" among what the search found, but it did not appear within
    Given I am a logged in user with the "member" user
    When I search the project "Webship site" for "greting"
    Then the search should show the user story "Add a test for the greeting"

  Scenario: A project a member may open is not refused
    Fails with: Expected to see the site's "Not found" (Error 404) for the project "Webship site", but it did not appear within
    Given I am a logged in user with the "member" user
    Then I should be refused the project "Webship site"
