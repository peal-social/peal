# frozen_string_literal: true

module Peal
  module Assistant
    module Types
      class AiProviderConnectionChange < Internal::Types::Model
        field :workspace_id, -> { String }, optional: false, nullable: false, api_name: "workspaceId"

        field :provider, -> { Peal::Types::AiProvider }, optional: false, nullable: false

        field :api_key, -> { String }, optional: true, nullable: false, api_name: "apiKey"

        field :base_url, -> { String }, optional: true, nullable: false, api_name: "baseUrl"
      end
    end
  end
end
