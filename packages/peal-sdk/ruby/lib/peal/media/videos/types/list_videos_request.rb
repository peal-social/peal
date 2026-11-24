# frozen_string_literal: true

module Peal
  module Media
    module Videos
      module Types
        class ListVideosRequest < Internal::Types::Model
          field :status, -> { Peal::Types::VideoGenerationStatus }, optional: true, nullable: false
        end
      end
    end
  end
end
