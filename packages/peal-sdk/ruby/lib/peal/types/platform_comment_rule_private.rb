# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    module PlatformCommentRulePrivate
      extend Peal::Internal::Types::Enum

      AVAILABLE = "available"
      NO_API = "noApi"
      UNSUPPORTED = "unsupported"
    end
  end
end
