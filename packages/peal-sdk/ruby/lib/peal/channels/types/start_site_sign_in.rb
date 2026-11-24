# frozen_string_literal: true

module Peal
  module Channels
    module Types
      class StartSiteSignIn < Internal::Types::Model
        field :platform, -> { Peal::Types::OAuthSitePlatform }, optional: false, nullable: false

        field :channel_id, -> { String }, optional: true, nullable: false, api_name: "channelId"
      end
    end
  end
end
