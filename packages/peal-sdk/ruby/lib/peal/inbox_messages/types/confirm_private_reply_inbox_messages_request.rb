# frozen_string_literal: true

module Peal
  module InboxMessages
    module Types
      class ConfirmPrivateReplyInboxMessagesRequest < Internal::Types::Model
        field :workspace_id, -> { String }, optional: false, nullable: false, api_name: "workspaceId"

        field :private_reply_id, -> { String }, optional: false, nullable: false, api_name: "privateReplyId"

        field :went, -> { Internal::Types::Boolean }, optional: false, nullable: false
      end
    end
  end
end
