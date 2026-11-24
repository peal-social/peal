# frozen_string_literal: true

module Peal
  module Inbox
    module Comments
      module Types
        class WithdrawReplyCommentsRequest < Internal::Types::Model
          field :reply_id, -> { String }, optional: false, nullable: false, api_name: "replyId"
        end
      end
    end
  end
end
