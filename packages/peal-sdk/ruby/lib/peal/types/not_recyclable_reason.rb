# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    module NotRecyclableReason
      extend Peal::Internal::Types::Enum

      DRAFT = "draft"
      AWAITING_APPROVAL = "awaitingApproval"
      CANCELLED = "cancelled"
      REPEATING = "repeating"
      OCCURRENCE = "occurrence"
      NO_CHANNELS = "noChannels"
      WEBSITES_ONLY = "websitesOnly"
    end
  end
end
