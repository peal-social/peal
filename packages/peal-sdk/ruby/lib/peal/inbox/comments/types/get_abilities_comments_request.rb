# frozen_string_literal: true

module Peal
  module Inbox
    module Comments
      module Types
        class GetAbilitiesCommentsRequest < Internal::Types::Model
          field :channel_id, -> { String }, optional: false, nullable: false, api_name: "channelId"
        end
      end
    end
  end
end
