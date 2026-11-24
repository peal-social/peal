# frozen_string_literal: true

module Peal
  module Webhooks
    module Types
      class GetWebhooksRequest < Internal::Types::Model
        field :endpoint_id, -> { String }, optional: false, nullable: false, api_name: "endpointId"
      end
    end
  end
end
