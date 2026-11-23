# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class VideoGeneration < Internal::Types::Model
      field :aspect, -> { Peal::Types::ImageAspect }, optional: false, nullable: false

      field :created_at, -> { String }, optional: false, nullable: false, api_name: "createdAt"

      field :duration_seconds, -> { Integer }, optional: false, nullable: true, api_name: "durationSeconds"

      field :finished_at, -> { String }, optional: false, nullable: true, api_name: "finishedAt"

      field :id, -> { String }, optional: false, nullable: false

      field :image_media_id, -> { String }, optional: false, nullable: true, api_name: "imageMediaId"

      field :media_id, -> { String }, optional: false, nullable: true, api_name: "mediaId"

      field :reason, -> { Peal::Types::VideoFailureReason }, optional: false, nullable: true

      field :started_at, -> { String }, optional: false, nullable: true, api_name: "startedAt"

      field :status, -> { Peal::Types::VideoGenerationStatus }, optional: false, nullable: false
    end
  end
end
