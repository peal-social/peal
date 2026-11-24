# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class CredentialBinding < Internal::Types::Model
      extend Peal::Internal::Types::Union

      discriminant :_tag

      member -> { Peal::Types::CredentialBindingUnbound }, key: "unbound"

      member -> { Peal::Types::CredentialBindingBound }, key: "bound"

      member -> { Peal::Types::CredentialBindingLeft }, key: "left"
    end
  end
end
