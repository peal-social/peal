# frozen_string_literal: true

module Peal
  module Inbox
    module Messages
      module Types
        class GetPrivateReplyMessagesRequest < Internal::Types::Model
          field :private_reply_id, -> { String }, optional: false, nullable: false, api_name: "privateReplyId"
        end
      end
    end
  end
end
