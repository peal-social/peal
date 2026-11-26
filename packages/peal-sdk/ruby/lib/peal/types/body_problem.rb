# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class BodyProblem < Internal::Types::Model
      field :column, -> { Integer }, optional: true, nullable: false

      field :line, -> { Integer }, optional: true, nullable: false

      field :problem, -> { Peal::Types::BodyProblemKind }, optional: false, nullable: false
    end
  end
end
