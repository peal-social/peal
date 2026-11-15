# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class MovedChannel < Internal::Types::Model
      field :channel, -> { Peal::Types::Channel }, optional: false, nullable: false

      field :posts_left, -> { Integer }, optional: false, nullable: false, api_name: "postsLeft"
    end
  end
end
