# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    module PrivateReplyRefusal
      extend Peal::Internal::Types::Enum

      OWN_COMMENT = "ownComment"
      GONE = "gone"
      TOO_OLD = "tooOld"
    end
  end
end
