# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    module InboxActionUnavailableReason
      extend Peal::Internal::Types::Enum

      WINDOW_CLOSED = "windowClosed"
    end
  end
end
