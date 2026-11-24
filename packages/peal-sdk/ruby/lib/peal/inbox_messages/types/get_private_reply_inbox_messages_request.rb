# frozen_string_literal: true

module Peal
  module InboxMessages
    module Types
      class GetPrivateReplyInboxMessagesRequest < Internal::Types::Model
        field :private_reply_id, -> { String }, optional: false, nullable: false, api_name: "privateReplyId"
      end
    end
  end
end
