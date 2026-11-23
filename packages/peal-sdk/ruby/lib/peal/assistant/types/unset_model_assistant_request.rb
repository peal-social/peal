# frozen_string_literal: true

module Peal
  module Assistant
    module Types
      class UnsetModelAssistantRequest < Internal::Types::Model
        field :workspace_id, -> { String }, optional: false, nullable: false, api_name: "workspaceId"

        field :capability, -> { Peal::Types::AiCapability }, optional: false, nullable: false
      end
    end
  end
end
