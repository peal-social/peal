# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class WorkspaceSecurity < Internal::Types::Model
      field :members_without_two_step, -> { Integer }, optional: true, nullable: false, api_name: "membersWithoutTwoStep"

      field :two_step_required, -> { Internal::Types::Boolean }, optional: false, nullable: false, api_name: "twoStepRequired"
    end
  end
end
