# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    module InboxPrivateReplyReason
      extend Peal::Internal::Types::Enum

      CHANNEL_UNAVAILABLE = "channelUnavailable"
      RECONNECT_NEEDED = "reconnectNeeded"
      RATE_LIMITED = "rateLimited"
      PLATFORM_UNAVAILABLE = "platformUnavailable"
      COMMENT_GONE = "commentGone"
      ALREADY_ANSWERED = "alreadyAnswered"
      REFUSED = "refused"
      WINDOW_CLOSED = "windowClosed"
      NOT_SENT = "notSent"
      NO_RESPONSE = "noResponse"
      INTERRUPTED = "interrupted"
      ADAPTER_FAILURE = "adapterFailure"
    end
  end
end
