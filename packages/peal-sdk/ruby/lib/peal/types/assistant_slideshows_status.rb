# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class AssistantSlideshowsStatus < Internal::Types::Model
      field :available, -> { Internal::Types::Boolean }, optional: false, nullable: false

      field :daily_limit, -> { Integer }, optional: false, nullable: false, api_name: "dailyLimit"

      field :payment_method_required, -> { Internal::Types::Boolean }, optional: false, nullable: false, api_name: "paymentMethodRequired"

      field :provider, -> { Peal::Types::AiProvider }, optional: false, nullable: true

      field :remaining, -> { Integer }, optional: false, nullable: false

      field :sandbox, -> { Internal::Types::Boolean }, optional: false, nullable: false
    end
  end
end
