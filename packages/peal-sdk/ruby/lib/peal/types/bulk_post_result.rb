# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class BulkPostResult < Internal::Types::Model
      extend Peal::Internal::Types::Union

      discriminant :_tag

      member -> { Peal::Types::BulkPostResultCreated }, key: "created"

      member -> { Peal::Types::BulkPostResultRefused }, key: "refused"
    end
  end
end
