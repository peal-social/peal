# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class PrivateReplyPendingEncoded < Internal::Types::Model
      field :code, -> { String }, optional: true, nullable: false

      field :message, -> { String }, optional: true, nullable: false

      field :request_id, -> { String }, optional: true, nullable: false, api_name: "requestId"

      field :private_reply_id, -> { String }, optional: false, nullable: false, api_name: "privateReplyId"
    end
  end
end
