# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class ServiceUnavailableErrorBody < Internal::Types::Model
      extend Peal::Internal::Types::Union

      discriminant :_tag

      member -> { Peal::Types::BillingUnavailableEncoded }, key: "BillingUnavailable"

      member -> { Peal::Types::MediaStoreUnavailableEncoded }, key: "MediaStoreUnavailable"
    end
  end
end
