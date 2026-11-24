# frozen_string_literal: true

module Peal
  module Channels
    module Types
      class SiteSignInCallback < Internal::Types::Model
        field :platform, -> { Peal::Types::OAuthSitePlatform }, optional: false, nullable: false

        field :code, -> { String }, optional: true, nullable: false

        field :error, -> { String }, optional: true, nullable: false

        field :state, -> { String }, optional: false, nullable: false
      end
    end
  end
end
