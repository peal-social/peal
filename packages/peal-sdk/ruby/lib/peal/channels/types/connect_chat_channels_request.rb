# frozen_string_literal: true

module Peal
  module Channels
    module Types
      class ConnectChatChannelsRequest < Internal::Types::Model
        field :workspace_id, -> { String }, optional: false, nullable: false, api_name: "workspaceId"

        field :body, -> { Peal::Types::ConnectChat }, optional: false, nullable: false
      end
    end
  end
end
