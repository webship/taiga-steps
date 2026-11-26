@stories
Feature: One user story
  As a member of a project
  I want to read a user story and work on it
  So that the team sees where it stands

  Scenario: A member reads a user story of the sample project
    Given I am a logged in user with the "member" user
    When I open the user story "The greeting script says Helo instead of Hello"
    Then the user story should have the status "In progress"
    And the user story should be created by "Owner Test"
    And the user story should be assigned to "Member Test"
    And the user story should have the tag "bug"
    And the user story should have the task "Fix the spelling in greeting.sh"
    And the user story should show the comment "Seen on the test site: the greeting prints Helo." by "Owner Test"

  Scenario: A member works a user story of its own
    Given there is a user story "Webship test work" in the project "Webship site"
    And I am a logged in user with the "member" user
    When I open the user story "Webship test work"
    And I change the status of the user story to "In progress"
    And I add the comment "Checked on the test site" to the user story
    And I add the tag "bug" to the user story
    And I assign the user story to "Member Test"
    Then the user story should have the status "In progress"
    And the user story should show the comment "Checked on the test site" by "Member Test"
    And the user story should have the tag "bug"
    And the user story should be assigned to "Member Test"
