# frozen_string_literal: true

module Peal
  module Slideshows
    module Types
      class ListSlideshowsRequest < Internal::Types::Model
        field :workspace_id, -> { String }, optional: false, nullable: false, api_name: "workspaceId"

        field :status, -> { Peal::Types::SlideshowStatus }, optional: true, nullable: false
      end
    end
  end
end
