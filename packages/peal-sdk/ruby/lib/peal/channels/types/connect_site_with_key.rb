# frozen_string_literal: true

module Peal
  module Channels
    module Types
      class ConnectSiteWithKey < Internal::Types::Model
        field :api_key, -> { String }, optional: false, nullable: false, api_name: "apiKey"

        field :platform, -> { Peal::Types::KeySitePlatform }, optional: false, nullable: false

        field :publication, -> { String }, optional: true, nullable: false
      end
    end
  end
end
