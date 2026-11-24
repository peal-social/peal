# frozen_string_literal: true

module Peal
  module VideoGenerations
    module Types
      class ListVideoGenerationsRequest < Internal::Types::Model
        field :status, -> { Peal::Types::VideoGenerationStatus }, optional: true, nullable: false
      end
    end
  end
end
