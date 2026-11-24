# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class BadRequestErrorBody < Internal::Types::Model
      extend Peal::Internal::Types::Union

      discriminant :_tag

      member -> { Peal::Types::InvalidDateRangeEncoded }, key: "InvalidDateRange"

      member -> { Peal::Types::EffectHttpApiErrorBadRequestEncoded }, key: "BadRequest"
    end
  end
end
