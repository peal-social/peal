# frozen_string_literal: true

module Peal
  module MediaAudio
    module Types
      class TranscriptionRequest < Internal::Types::Model
        field :workspace_id, -> { String }, optional: false, nullable: false, api_name: "workspaceId"

        field :media_id, -> { String }, optional: false, nullable: false, api_name: "mediaId"

        field :save_as_description, -> { Internal::Types::Boolean }, optional: true, nullable: false, api_name: "saveAsDescription"
      end
    end
  end
end
