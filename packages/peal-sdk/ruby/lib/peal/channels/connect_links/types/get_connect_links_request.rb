# frozen_string_literal: true

module Peal
  module Channels
    module ConnectLinks
      module Types
        class GetConnectLinksRequest < Internal::Types::Model
          field :link_id, -> { String }, optional: false, nullable: false, api_name: "linkId"
        end
      end
    end
  end
end
