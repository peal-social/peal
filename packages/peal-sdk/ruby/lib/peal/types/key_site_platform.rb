# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    module KeySitePlatform
      extend Peal::Internal::Types::Enum

      DEVTO = "devto"
      HASHNODE = "hashnode"
    end
  end
end
