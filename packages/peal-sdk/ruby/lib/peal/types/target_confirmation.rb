# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class TargetConfirmation < Internal::Types::Model
      extend Peal::Internal::Types::Union

      discriminant :_tag

      member -> { Peal::Types::TargetConfirmationPublished }, key: "published"

      member -> { Peal::Types::TargetConfirmationNotPublished }, key: "notPublished"
    end
  end
end
