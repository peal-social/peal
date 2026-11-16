# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class ConnectablePlatforms < Internal::Types::Model
      field :instagram_connections, -> { Internal::Types::Array[Peal::Types::InstagramConnection] }, optional: false, nullable: false, api_name: "instagramConnections"

      field :linkedin_connections, -> { Internal::Types::Array[Peal::Types::LinkedInConnection] }, optional: false, nullable: false, api_name: "linkedinConnections"

      field :platforms, -> { Internal::Types::Array[Peal::Types::Platform] }, optional: false, nullable: false

      field :chats, -> { Internal::Types::Array[Peal::Types::ChatPlatform] }, optional: true, nullable: false

      field :sites, -> { Internal::Types::Array[Peal::Types::SitePlatform] }, optional: true, nullable: false
    end
  end
end
