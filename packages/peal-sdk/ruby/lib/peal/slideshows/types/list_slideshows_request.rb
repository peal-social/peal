# frozen_string_literal: true

module Peal
  module Slideshows
    module Types
      class ListSlideshowsRequest < Internal::Types::Model
        field :status, -> { Peal::Types::SlideshowStatus }, optional: true, nullable: false
      end
    end
  end
end
