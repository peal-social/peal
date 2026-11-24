# frozen_string_literal: true

module Peal
  module Queues
    module Types
      class SlotsQueuesRequest < Internal::Types::Model
        field :queue_id, -> { String }, optional: false, nullable: false, api_name: "queueId"

        field :count, -> { String }, optional: true, nullable: false
      end
    end
  end
end
