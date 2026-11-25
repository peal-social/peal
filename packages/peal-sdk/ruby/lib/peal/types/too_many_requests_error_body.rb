# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class TooManyRequestsErrorBody < Internal::Types::Model
      extend Peal::Internal::Types::Union

      discriminant :_tag

      member -> { Peal::Types::OwnTextLimitReachedEncoded }, key: "OwnTextLimitReached"

      member -> { Peal::Types::TextProviderBusyEncoded }, key: "TextProviderBusy"

      member -> { Peal::Types::TooManyRequestsEncoded }, key: "TooManyRequests"
    end
  end
end
