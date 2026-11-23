# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class SlideshowRequestRejectedEncoded < Internal::Types::Model
      field :tag, -> { Peal::Types::SlideshowRequestRejectedEncodedTag }, optional: false, nullable: false, api_name: "_tag"

      field :code, -> { String }, optional: true, nullable: false

      field :message, -> { String }, optional: true, nullable: false

      field :request_id, -> { String }, optional: true, nullable: false, api_name: "requestId"

      field :reason, -> { Peal::Types::SlideshowRejection }, optional: false, nullable: false
    end
  end
end
