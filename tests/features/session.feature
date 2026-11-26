@session
Feature: Signing in and out
  As a person with an account of the site
  I want to sign in with my username and my password, and out again
  So that only the people the site knows work in its projects

  Scenario: A member signs in and out
    Given I am not logged in
    When I log in with the "member" user
    Then I should be logged in as "Member Test"
    When I log out
    Then I should not be logged in

  Scenario: A wrong password is refused
    Given I am not logged in
    When I log in as "member" with the password "not-the-right-password"
    Then the login should be refused with "your username/email or password are incorrect"
    And I should not be logged in

  Scenario: An account the site does not have is refused the same way
    Given I am not logged in
    When I log in as "nobody-at-all" with the password "not-the-right-password"
    Then the login should be refused with "your username/email or password are incorrect"
    And I should not be logged in
