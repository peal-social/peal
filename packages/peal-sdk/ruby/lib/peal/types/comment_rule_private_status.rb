# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    module CommentRulePrivateStatus
      extend Peal::Internal::Types::Enum

      SENDING = "sending"
      SENT = "sent"
      FAILED = "failed"
      UNCONFIRMED = "unconfirmed"
    end
  end
end
