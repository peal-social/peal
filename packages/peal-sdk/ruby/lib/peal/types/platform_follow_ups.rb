# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class PlatformFollowUps < Internal::Types::Model
      field :comment, -> { Peal::Types::PlatformFollowUpComment }, optional: false, nullable: false

      field :platform, -> { Peal::Types::Platform }, optional: false, nullable: false

      field :repost, -> { Peal::Types::PlatformFollowUpRepost }, optional: false, nullable: false
    end
  end
end
