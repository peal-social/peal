# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class TooManyRequestsErrorBody < Internal::Types::Model
      extend Peal::Internal::Types::Union

      discriminant :type

      member -> { Peal::Types::OwnTextLimitReachedEncoded }, key: "OWN_TEXT_LIMIT_REACHED"

      member -> { Peal::Types::TextProviderBusyEncoded }, key: "TEXT_PROVIDER_BUSY"

      member -> { Peal::Types::TooManyRequestsEncoded }, key: "TOO_MANY_REQUESTS"
    end
  end
end
