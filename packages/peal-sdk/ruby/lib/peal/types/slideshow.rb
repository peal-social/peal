# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class Slideshow < Internal::Types::Model
      field :aspect, -> { Peal::Types::ImageAspect }, optional: false, nullable: false

      field :created_at, -> { String }, optional: false, nullable: false, api_name: "createdAt"

      field :duration_seconds, -> { Peal::Types::SlideshowDurationSeconds }, optional: false, nullable: false, api_name: "durationSeconds"

      field :finished_at, -> { String }, optional: false, nullable: true, api_name: "finishedAt"

      field :id, -> { String }, optional: false, nullable: false

      field :image_media_ids, -> { Internal::Types::Array[String] }, optional: false, nullable: false, api_name: "imageMediaIds"

      field :media_id, -> { String }, optional: false, nullable: true, api_name: "mediaId"

      field :reason, -> { Peal::Types::SlideshowFailureReason }, optional: false, nullable: true

      field :sandbox, -> { Internal::Types::Boolean }, optional: false, nullable: false

      field :started_at, -> { String }, optional: false, nullable: true, api_name: "startedAt"

      field :status, -> { Peal::Types::SlideshowStatus }, optional: false, nullable: false

      field :voiceover_media_id, -> { String }, optional: false, nullable: true, api_name: "voiceoverMediaId"
    end
  end
end
