# frozen_string_literal: true

module Peal
  module Assistant
    module Types
      class ImageProviderChange < Internal::Types::Model
        field :api_key, -> { String }, optional: true, nullable: false, api_name: "apiKey"

        field :base_url, -> { String }, optional: true, nullable: false, api_name: "baseUrl"

        field :model, -> { String }, optional: false, nullable: false

        field :provider, -> { Peal::Types::AiImageProvider }, optional: true, nullable: false
      end
    end
  end
end
