# frozen_string_literal: true

module Peal
  module Posts
    module Types
      class PostExternalIDChange < Internal::Types::Model
        field :post_id, -> { String }, optional: false, nullable: false, api_name: "postId"

        field :external_id, -> { String }, optional: false, nullable: true, api_name: "externalId"
      end
    end
  end
end
