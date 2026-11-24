# frozen_string_literal: true

module Peal
  module Channels
    module DefaultOptions
      module Types
        class ClearDefaultOptionsRequest < Internal::Types::Model
          field :channel_id, -> { String }, optional: false, nullable: false, api_name: "channelId"
        end
      end
    end
  end
end
