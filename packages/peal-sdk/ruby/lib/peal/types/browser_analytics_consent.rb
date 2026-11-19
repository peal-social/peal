# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    module BrowserAnalyticsConsent
      extend Peal::Internal::Types::Enum

      UNDECIDED = "undecided"
      GRANTED = "granted"
      REFUSED = "refused"
    end
  end
end
