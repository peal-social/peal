# frozen_string_literal: true

module Peal
  module VideoGenerations
    module Types
      class ListVideoGenerationsRequest < Internal::Types::Model
        field :workspace_id, -> { String }, optional: false, nullable: false, api_name: "workspaceId"

        field :status, -> { Peal::Types::VideoGenerationStatus }, optional: true, nullable: false
      end
    end
  end
end
