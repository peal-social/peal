# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    module PlatformFollowUpComment
      extend Peal::Internal::Types::Enum

      AVAILABLE = "available"
      NO_API = "noApi"
      REVIEW = "review"
      NOT_BUILT = "notBuilt"
      NOT_ALLOWED = "notAllowed"
      TURNED_OFF = "turnedOff"
      NOT_COUNTED = "notCounted"
    end
  end
end
