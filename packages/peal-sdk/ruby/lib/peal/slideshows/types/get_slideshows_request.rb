# frozen_string_literal: true

module Peal
  module Slideshows
    module Types
      class GetSlideshowsRequest < Internal::Types::Model
        field :slideshow_id, -> { String }, optional: false, nullable: false, api_name: "slideshowId"
      end
    end
  end
end
