# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class Credential < Internal::Types::Model
      extend Peal::Internal::Types::Union

      discriminant :_tag

      member -> { Peal::Types::CredentialUser }, key: "user"

      member -> { Peal::Types::CredentialAPIKey }, key: "apiKey"

      member -> { Peal::Types::CredentialPartnerKey }, key: "partnerKey"
    end
  end
end
