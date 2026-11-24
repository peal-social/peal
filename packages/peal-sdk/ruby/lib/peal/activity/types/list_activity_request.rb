# frozen_string_literal: true

module Peal
  module Activity
    module Types
      class ListActivityRequest < Internal::Types::Model
        field :actor, -> { String }, optional: true, nullable: false

        field :cursor, -> { String }, optional: true, nullable: false

        field :limit, -> { String }, optional: true, nullable: false

        field :operation, -> { String }, optional: true, nullable: false
      end
    end
  end
end
