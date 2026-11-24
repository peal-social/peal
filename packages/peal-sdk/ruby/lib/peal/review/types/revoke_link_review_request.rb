# frozen_string_literal: true

module Peal
  module Review
    module Types
      class RevokeLinkReviewRequest < Internal::Types::Model
        field :link_id, -> { String }, optional: false, nullable: false, api_name: "linkId"
      end
    end
  end
end
