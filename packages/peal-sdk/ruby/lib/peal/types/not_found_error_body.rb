# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class NotFoundErrorBody < Internal::Types::Model
      extend Peal::Internal::Types::Union

      discriminant :_tag

      member -> { Peal::Types::PartnerNotFoundEncoded }, key: "PartnerNotFound"

      member -> { Peal::Types::WorkspaceNotFoundEncoded }, key: "WorkspaceNotFound"
    end
  end
end
