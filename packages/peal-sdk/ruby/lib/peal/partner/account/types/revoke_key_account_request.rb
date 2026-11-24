# frozen_string_literal: true

module Peal
  module Partner
    module Account
      module Types
        class RevokeKeyAccountRequest < Internal::Types::Model
          field :partner_key_id, -> { String }, optional: false, nullable: false, api_name: "partnerKeyId"
        end
      end
    end
  end
end
