# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    # How a post goes out on a Snapchat Public Profile, as a Spotlight. Scheduling needs none of them; `locale` is the
    # Spotlight's language and country, as Snap's `locale` takes them (`en_US`), and `en_US` when left out.
    class SnapchatOptions < Internal::Types::Model
      field :locale, -> { String }, optional: true, nullable: false
    end
  end
end
