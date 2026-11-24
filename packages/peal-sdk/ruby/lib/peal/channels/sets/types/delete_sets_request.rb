# frozen_string_literal: true

module Peal
  module Channels
    module Sets
      module Types
        class DeleteSetsRequest < Internal::Types::Model
          field :channel_set_id, -> { String }, optional: false, nullable: false, api_name: "channelSetId"
        end
      end
    end
  end
end
