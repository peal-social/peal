# frozen_string_literal: true

module Peal
  module Channels
    module Sets
      module Types
        class UpdateSetsRequest < Internal::Types::Model
          field :channel_set_id, -> { String }, optional: false, nullable: false, api_name: "channelSetId"

          field :body, -> { Peal::Types::ChannelSetDetails }, optional: false, nullable: false
        end
      end
    end
  end
end
