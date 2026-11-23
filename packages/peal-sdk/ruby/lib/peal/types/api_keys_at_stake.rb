# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class APIKeysAtStake < Internal::Types::Model
      field :removal, -> { Integer }, optional: false, nullable: false

      field :roles, -> { Peal::Types::APIKeysAtStakeRoles }, optional: false, nullable: false
    end
  end
end
