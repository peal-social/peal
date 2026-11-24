# frozen_string_literal: true

module Peal
  module Automations
    module CommentRules
      module Types
        class NewCommentRule < Internal::Types::Model
          field :channel_id, -> { String }, optional: true, nullable: false, api_name: "channelId"

          field :keywords, -> { Internal::Types::Array[String] }, optional: false, nullable: false

          field :post_id, -> { String }, optional: true, nullable: false, api_name: "postId"

          field :private_reply, -> { String }, optional: true, nullable: false, api_name: "privateReply"

          field :reply, -> { String }, optional: false, nullable: false
        end
      end
    end
  end
end
