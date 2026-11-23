# frozen_string_literal: true

module Peal
  module Assistant
    module Types
      class DisconnectProviderAssistantRequest < Internal::Types::Model
        field :workspace_id, -> { String }, optional: false, nullable: false, api_name: "workspaceId"

        field :provider, -> { Peal::Types::AiProvider }, optional: false, nullable: false
      end
    end
  end
end
