# frozen_string_literal: true

module Peal
  module Posts
    module Signatures
      module Types
        class UpdateSignaturesRequest < Internal::Types::Model
          field :signature_id, -> { String }, optional: false, nullable: false, api_name: "signatureId"

          field :body, -> { Peal::Types::SignatureDetails }, optional: false, nullable: false
        end
      end
    end
  end
end
