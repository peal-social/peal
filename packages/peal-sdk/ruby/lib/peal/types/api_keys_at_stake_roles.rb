# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class APIKeysAtStakeRoles < Internal::Types::Model
      field :admin, -> { Integer }, optional: false, nullable: false

      field :contributor, -> { Integer }, optional: false, nullable: false

      field :editor, -> { Integer }, optional: false, nullable: false

      field :owner, -> { Integer }, optional: false, nullable: false

      field :viewer, -> { Integer }, optional: false, nullable: false
    end
  end
end
