# frozen_string_literal: true

module Peal
  module Posts
    module Signatures
      module Types
        class DeleteSignaturesRequest < Internal::Types::Model
          field :signature_id, -> { String }, optional: false, nullable: false, api_name: "signatureId"
        end
      end
    end
  end
end
