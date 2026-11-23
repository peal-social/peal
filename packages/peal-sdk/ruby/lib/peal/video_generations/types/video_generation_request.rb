# frozen_string_literal: true

module Peal
  module VideoGenerations
    module Types
      class VideoGenerationRequest < Internal::Types::Model
        field :workspace_id, -> { String }, optional: false, nullable: false, api_name: "workspaceId"

        field :aspect, -> { Peal::Types::ImageAspect }, optional: false, nullable: false

        field :duration_seconds, -> { Integer }, optional: true, nullable: false, api_name: "durationSeconds"

        field :image_media_id, -> { String }, optional: true, nullable: false, api_name: "imageMediaId"

        field :prompt, -> { String }, optional: false, nullable: false
      end
    end
  end
end
