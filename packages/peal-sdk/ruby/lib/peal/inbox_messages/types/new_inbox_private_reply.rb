# frozen_string_literal: true

module Peal
  module InboxMessages
    module Types
      class NewInboxPrivateReply < Internal::Types::Model
        field :idempotency_key, -> { String }, optional: true, nullable: false, api_name: "idempotency-key"

        field :comment_id, -> { String }, optional: false, nullable: false, api_name: "commentId"

        field :text, -> { String }, optional: false, nullable: false
      end
    end
  end
end
