# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class NoticeEventSlideshowEnded < Internal::Types::Model
      field :media_id, -> { String }, optional: false, nullable: true, api_name: "mediaId"

      field :outcome, -> { Peal::Types::NoticeEventSlideshowEndedOutcome }, optional: false, nullable: false

      field :reason, -> { Peal::Types::SlideshowFailureReason }, optional: false, nullable: true

      field :slideshow_id, -> { String }, optional: false, nullable: false, api_name: "slideshowId"
    end
  end
end
