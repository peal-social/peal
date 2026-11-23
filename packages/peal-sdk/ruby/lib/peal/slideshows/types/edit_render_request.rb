# frozen_string_literal: true

module Peal
  module Slideshows
    module Types
      class EditRenderRequest < Internal::Types::Model
        field :workspace_id, -> { String }, optional: false, nullable: false, api_name: "workspaceId"

        field :edit, -> { Internal::Types::Hash[String, Object] }, optional: false, nullable: false
      end
    end
  end
end
