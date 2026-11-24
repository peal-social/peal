# frozen_string_literal: true

module Peal
  module Posts
    module Types
      class CalendarPostsRequest < Internal::Types::Model
        field :from, -> { String }, optional: false, nullable: false

        field :to, -> { String }, optional: false, nullable: false
      end
    end
  end
end
