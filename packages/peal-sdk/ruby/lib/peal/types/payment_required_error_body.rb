# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class PaymentRequiredErrorBody < Internal::Types::Model
      extend Peal::Internal::Types::Union

      discriminant :_tag

      member -> { Peal::Types::CompositionNeedsPaymentEncoded }, key: "CompositionNeedsPayment"

      member -> { Peal::Types::PlanLimitReachedEncoded }, key: "PlanLimitReached"
    end
  end
end
