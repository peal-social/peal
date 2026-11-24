# frozen_string_literal: true

module Peal
  module MediaAudio
    module Types
      class VoiceoverRequest < Internal::Types::Model
        field :text, -> { String }, optional: false, nullable: false

        field :voice, -> { String }, optional: true, nullable: false
      end
    end
  end
end
