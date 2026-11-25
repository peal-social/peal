# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    module PlatformFollowUpRepost
      extend Peal::Internal::Types::Enum

      AVAILABLE = "available"
      NO_API = "noApi"
      NOT_BUILT = "notBuilt"
      NOT_ALLOWED = "notAllowed"
      NOT_COUNTED = "notCounted"
    end
  end
end
