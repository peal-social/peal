# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class TranscriptionRejectedEncoded < Internal::Types::Model
      field :tag, -> { Peal::Types::TranscriptionRejectedEncodedTag }, optional: false, nullable: false, api_name: "_tag"

      field :code, -> { String }, optional: true, nullable: false

      field :message, -> { String }, optional: true, nullable: false

      field :request_id, -> { String }, optional: true, nullable: false, api_name: "requestId"

      field :max_bytes, -> { Integer }, optional: false, nullable: false, api_name: "maxBytes"

      field :reason, -> { Peal::Types::TranscriptionRejectedEncodedReason }, optional: false, nullable: false
    end
  end
end
