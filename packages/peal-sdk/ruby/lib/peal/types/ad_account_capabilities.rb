# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    # What Peal reads and does on an ad account, as its network allows: a client hides what is false (the ads list,
    # boosting and spending, reach, results).
    class AdAccountCapabilities < Internal::Types::Model
      field :ads, -> { Internal::Types::Boolean }, optional: false, nullable: false

      field :boosts, -> { Internal::Types::Boolean }, optional: false, nullable: false

      field :reach, -> { Internal::Types::Boolean }, optional: false, nullable: false

      field :results, -> { Internal::Types::Boolean }, optional: false, nullable: false
    end
  end
end
