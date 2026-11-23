# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class NoticeEventVideoGenerationEnded < Internal::Types::Model
      field :generation_id, -> { String }, optional: false, nullable: false, api_name: "generationId"

      field :media_id, -> { String }, optional: false, nullable: true, api_name: "mediaId"

      field :outcome, -> { Peal::Types::NoticeEventVideoGenerationEndedOutcome }, optional: false, nullable: false

      field :reason, -> { Peal::Types::VideoFailureReason }, optional: false, nullable: true
    end
  end
end
