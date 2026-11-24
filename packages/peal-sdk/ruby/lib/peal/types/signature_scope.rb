# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class SignatureScope < Internal::Types::Model
      extend Peal::Internal::Types::Union

      discriminant :_tag

      member -> { Peal::Types::SignatureScopeWorkspace }, key: "workspace"

      member -> { Peal::Types::SignatureScopePlatform }, key: "platform"

      member -> { Peal::Types::SignatureScopeChannel }, key: "channel"
    end
  end
end
