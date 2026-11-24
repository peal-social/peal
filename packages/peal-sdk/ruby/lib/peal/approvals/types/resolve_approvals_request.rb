# frozen_string_literal: true

module Peal
  module Approvals
    module Types
      class ResolveApprovalsRequest < Internal::Types::Model
        field :post_id, -> { String }, optional: false, nullable: false, api_name: "postId"

        field :comment_id, -> { String }, optional: false, nullable: false, api_name: "commentId"

        field :resolved, -> { Internal::Types::Boolean }, optional: false, nullable: false
      end
    end
  end
end
