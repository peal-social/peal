# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class CompositionNeedsPaymentEncoded < Internal::Types::Model
      field :code, -> { String }, optional: true, nullable: false

      field :message, -> { String }, optional: true, nullable: false

      field :request_id, -> { String }, optional: true, nullable: false, api_name: "requestId"

      field :billing_url, -> { String }, optional: false, nullable: false, api_name: "billingUrl"
    end
  end
end
