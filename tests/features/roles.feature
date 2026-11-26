@roles
Feature: Who may do what in a project
  As the administrator of a project
  I want its readers to read it and nothing more, and the people it does not have to be kept out
  So that only its members change its work

  Scenario: A reader reads a user story and changes nothing
    Given I am a logged in user with the "reader" user
    When I open the user story "The greeting script says Helo instead of Hello"
    Then the user story should have the status "In progress"
    And I should not be able to change the user story
    And I should not be able to comment on the user story

  Scenario: A reader may not add a user story
    Given I am a logged in user with the "reader" user
    When I open the backlog of the project "Webship site"
    Then the backlog should show the user story "The usage line spells greeting as greting"
    And I should not be able to add a user story

  @js-off
  Scenario: An account the project does not have is refused it
    Given I am a logged in user with the "stranger" user
    Then I should be refused the project "Webship site"

  @js-off
  Scenario: A visitor is sent to the sign-in form
    Given I am not logged in
    When I open the backlog of the project "Webship site"
    Then I should be sent to the login form
