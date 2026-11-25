# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class UnprocessableEntityErrorBody < Internal::Types::Model
      extend Peal::Internal::Types::Union

      discriminant :_tag

      member -> { Peal::Types::AiCapabilityNotOfferedEncoded }, key: "AiCapabilityNotOffered"

      member -> { Peal::Types::AiModelRequiredEncoded }, key: "AiModelRequired"
    end
  end
end
