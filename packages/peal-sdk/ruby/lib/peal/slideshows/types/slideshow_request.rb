# frozen_string_literal: true

module Peal
  module Slideshows
    module Types
      class SlideshowRequest < Internal::Types::Model
        field :aspect, -> { Peal::Types::ImageAspect }, optional: false, nullable: false

        field :seconds_per_slide, -> { Integer }, optional: true, nullable: false, api_name: "secondsPerSlide"

        field :slides, -> { Internal::Types::Array[Peal::Types::Slide] }, optional: false, nullable: false

        field :transition, -> { Peal::Types::SlideTransition }, optional: true, nullable: false

        field :voiceover_media_id, -> { String }, optional: true, nullable: false, api_name: "voiceoverMediaId"
      end
    end
  end
end
