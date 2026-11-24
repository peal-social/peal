# frozen_string_literal: true

module Peal
  module Inbox
    module Types
      class NewInboxReply < Internal::Types::Model
        field :comment_id, -> { String }, optional: false, nullable: false, api_name: "commentId"

        field :idempotency_key, -> { String }, optional: true, nullable: false, api_name: "idempotency-key"

        field :text, -> { String }, optional: false, nullable: false
      end
    end
  end
end
