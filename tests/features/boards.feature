@boards
Feature: The taskboard of a sprint, the Kanban board and the search
  As a member of a project
  I want to see the sprint's user stories with their tasks, and every user story by its status
  So that I see the work as it moves

  Scenario: The taskboard of Sprint 1
    Given I am a logged in user with the "member" user
    When I open the taskboard of the sprint "Sprint 1" of the project "Webship site"
    Then the taskboard should show the user story "The greeting script says Helo instead of Hello"
    And the taskboard should show the user story "Add a test for the greeting"
    And the taskboard should not show the user story "The usage line spells greeting as greting"
    And the taskboard should show the task "Fix the spelling in greeting.sh" in the column "New"

  Scenario: The Kanban board shows each user story in the column of its status
    Given I am a logged in user with the "member" user
    When I open the kanban board of the project "Webship site"
    Then the column "In progress" should show the user story "The greeting script says Helo instead of Hello"
    And the column "New" should show the user story "The usage line spells greeting as greting"
    And the column "Done" should show the user story "Add a test for the greeting"
    And the column "New" should not show the user story "The greeting script says Helo instead of Hello"

  Scenario: A user story moved on its page moves on the Kanban board
    Given there is a user story "Webship test board" in the sprint "Sprint 1" of the project "Webship site"
    And I am a logged in user with the "member" user
    When I open the user story "Webship test board"
    And I change the status of the user story to "Ready for test"
    And I open the kanban board of the project "Webship site"
    Then the column "Ready for test" should show the user story "Webship test board"
    When I open the taskboard of the sprint "Sprint 1" of the project "Webship site"
    Then the taskboard should show the user story "Webship test board"

  Scenario: The search finds a user story by its words
    Given I am a logged in user with the "member" user
    When I search the project "Webship site" for "greting"
    Then the search should show the user story "The usage line spells greeting as greting"
    And the search should not show the user story "Add a test for the greeting"
