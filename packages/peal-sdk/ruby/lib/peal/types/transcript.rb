# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class Transcript < Internal::Types::Model
      field :description_saved, -> { Internal::Types::Boolean }, optional: false, nullable: false, api_name: "descriptionSaved"

      field :duration_seconds, -> { Peal::Types::TranscriptDurationSeconds }, optional: false, nullable: true, api_name: "durationSeconds"

      field :language, -> { String }, optional: false, nullable: true

      field :text, -> { String }, optional: false, nullable: false
    end
  end
end
