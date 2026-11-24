# frozen_string_literal: true

module Peal
  module Approvals
    module Types
      class ListLinksApprovalsRequest < Internal::Types::Model
        field :post_id, -> { String }, optional: false, nullable: false, api_name: "postId"
      end
    end
  end
end
