# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class ContentViolationBodyInvalid < Internal::Types::Model
      field :channel_id, -> { String }, optional: false, nullable: false, api_name: "channelId"

      field :part, -> { Integer }, optional: true, nullable: false
    end
  end
end
