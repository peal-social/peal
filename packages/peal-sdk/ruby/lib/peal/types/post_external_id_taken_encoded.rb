# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class PostExternalIDTakenEncoded < Internal::Types::Model
      field :tag, -> { Peal::Types::PostExternalIDTakenEncodedTag }, optional: false, nullable: false, api_name: "_tag"

      field :code, -> { String }, optional: true, nullable: false

      field :message, -> { String }, optional: true, nullable: false

      field :request_id, -> { String }, optional: true, nullable: false, api_name: "requestId"

      field :post_id, -> { String }, optional: false, nullable: true, api_name: "postId"
    end
  end
end
