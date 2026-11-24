# frozen_string_literal: true

module Peal
  module Media
    module Videos
      module Types
        class GetVideosRequest < Internal::Types::Model
          field :generation_id, -> { String }, optional: false, nullable: false, api_name: "generationId"
        end
      end
    end
  end
end
