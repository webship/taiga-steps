@backlog
Feature: The backlog and its sprints
  As a member of a Scrum project
  I want to see the user stories not planned yet beside the open sprints
  So that I know what is in the sprint and what waits for one

  Scenario: The backlog lists what waits, and the sprint its own
    Given I am a logged in user with the "member" user
    When I open the backlog of the project "Webship site"
    Then the backlog should show the user story "The usage line spells greeting as greting"
    And the backlog should not show the user story "The greeting script says Helo instead of Hello"
    And the sprint "Sprint 1" should show the user story "The greeting script says Helo instead of Hello"
    And the sprint "Sprint 1" should show the user story "Add a test for the greeting"
    And the sprint "Sprint 1" should not show the user story "The usage line spells greeting as greting"

  Scenario: A member adds a user story to the backlog
    Given there is no user story "Webship test new" in the project "Webship site"
    And I am a logged in user with the "member" user
    When I open the backlog of the project "Webship site"
    And I add the user story "Webship test new" to the backlog
    Then the backlog should show the user story "Webship test new"
    When I open the user story "Webship test new"
    Then the user story should be created by "Member Test"
    And the user story should have the status "New"
