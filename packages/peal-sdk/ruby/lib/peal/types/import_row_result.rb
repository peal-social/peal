# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class ImportRowResult < Internal::Types::Model
      extend Peal::Internal::Types::Union

      discriminant :_tag

      member -> { Peal::Types::ImportRowResultCreated }, key: "created"

      member -> { Peal::Types::ImportRowResultValid }, key: "valid"

      member -> { Peal::Types::ImportRowResultRefused }, key: "refused"

      member -> { Peal::Types::ImportRowResultUnreadable }, key: "unreadable"
    end
  end
end
