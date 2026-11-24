# frozen_string_literal: true

module Peal
  module Automations
    module Feeds
      module Types
        class FeedPreviewRequest < Internal::Types::Model
          field :template, -> { String }, optional: true, nullable: false

          field :url, -> { String }, optional: false, nullable: false
        end
      end
    end
  end
end
