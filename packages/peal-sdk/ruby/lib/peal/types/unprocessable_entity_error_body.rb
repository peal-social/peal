# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class UnprocessableEntityErrorBody < Internal::Types::Model
      extend Peal::Internal::Types::Union

      discriminant :type

      member -> { Peal::Types::AiCapabilityNotOfferedEncoded }, key: "AI_CAPABILITY_NOT_OFFERED"

      member -> { Peal::Types::AiModelRequiredEncoded }, key: "AI_MODEL_REQUIRED"
    end
  end
end
