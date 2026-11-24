# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class OptionConstraint < Internal::Types::Model
      extend Peal::Internal::Types::Union

      discriminant :_tag

      member -> { Peal::Types::OptionConstraintNeedsOneOf }, key: "needsOneOf"

      member -> { Peal::Types::OptionConstraintNotWith }, key: "notWith"

      member -> { Peal::Types::OptionConstraintNeededWith }, key: "neededWith"

      member -> { Peal::Types::OptionConstraintOnlyWith }, key: "onlyWith"
    end
  end
end
