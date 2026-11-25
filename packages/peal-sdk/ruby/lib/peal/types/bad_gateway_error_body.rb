# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class BadGatewayErrorBody < Internal::Types::Model
      extend Peal::Internal::Types::Union

      discriminant :_tag

      member -> { Peal::Types::TextProviderRefusedEncoded }, key: "TextProviderRefused"

      member -> { Peal::Types::AssistantFailedEncoded }, key: "AssistantFailed"
    end
  end
end
