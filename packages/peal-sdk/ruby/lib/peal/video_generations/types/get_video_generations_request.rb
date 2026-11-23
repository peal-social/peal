# frozen_string_literal: true

module Peal
  module VideoGenerations
    module Types
      class GetVideoGenerationsRequest < Internal::Types::Model
        field :workspace_id, -> { String }, optional: false, nullable: false, api_name: "workspaceId"

        field :generation_id, -> { String }, optional: false, nullable: false, api_name: "generationId"
      end
    end
  end
end
