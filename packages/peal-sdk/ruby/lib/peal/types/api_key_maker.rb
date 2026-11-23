# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class APIKeyMaker < Internal::Types::Model
      field :id, -> { String }, optional: false, nullable: false

      field :name, -> { String }, optional: false, nullable: false
    end
  end
end
