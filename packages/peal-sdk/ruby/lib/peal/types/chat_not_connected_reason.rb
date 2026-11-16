# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    module ChatNotConnectedReason
      extend Peal::Internal::Types::Enum

      ADDRESS_NOT_A_WEBHOOK = "addressNotAWebhook"
      WEBHOOK_NOT_FOUND = "webhookNotFound"
      WEBHOOK_KIND_NOT_SUPPORTED = "webhookKindNotSupported"
      CREDENTIALS_REFUSED = "credentialsRefused"
      CHAT_NOT_FOUND = "chatNotFound"
      CHAT_KIND_NOT_SUPPORTED = "chatKindNotSupported"
      CANNOT_POST = "cannotPost"
    end
  end
end
