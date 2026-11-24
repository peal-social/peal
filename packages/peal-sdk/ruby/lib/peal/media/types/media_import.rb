# frozen_string_literal: true

module Peal
  module Media
    module Types
      class MediaImport < Internal::Types::Model
        field :alt_text, -> { String }, optional: true, nullable: true, api_name: "altText"

        field :url, -> { String }, optional: false, nullable: false
      end
    end
  end
end
