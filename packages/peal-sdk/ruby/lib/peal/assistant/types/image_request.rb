# frozen_string_literal: true

module Peal
  module Assistant
    module Types
      class ImageRequest < Internal::Types::Model
        field :aspect, -> { Peal::Types::ImageAspect }, optional: false, nullable: false

        field :prompt, -> { String }, optional: false, nullable: false
      end
    end
  end
end
