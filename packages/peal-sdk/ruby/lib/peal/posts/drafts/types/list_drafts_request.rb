# frozen_string_literal: true

module Peal
  module Posts
    module Drafts
      module Types
        class ListDraftsRequest < Internal::Types::Model
          field :cursor, -> { String }, optional: true, nullable: false

          field :limit, -> { String }, optional: true, nullable: false
        end
      end
    end
  end
end
