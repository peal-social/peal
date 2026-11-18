# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class BrowserAnalytics < Internal::Types::Model
      field :token, -> { String }, optional: false, nullable: false

      field :environment, -> { String }, optional: false, nullable: false

      field :consent, -> { Peal::Types::BrowserAnalyticsConsent }, optional: false, nullable: false

      field :decided_at, -> { String }, optional: false, nullable: true, api_name: "decidedAt"

      field :excluded_workspace_ids, -> { Internal::Types::Array[String] }, optional: false, nullable: false, api_name: "excludedWorkspaceIds"
    end
  end
end
