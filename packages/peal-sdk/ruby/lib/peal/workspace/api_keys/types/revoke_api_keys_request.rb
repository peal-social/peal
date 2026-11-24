# frozen_string_literal: true

module Peal
  module Workspace
    module APIKeys
      module Types
        class RevokeAPIKeysRequest < Internal::Types::Model
          field :api_key_id, -> { String }, optional: false, nullable: false, api_name: "apiKeyId"
        end
      end
    end
  end
end
