# frozen_string_literal: true

module Peal
  module Media
    module Slideshows
      module Types
        class EditRenderRequest < Internal::Types::Model
          field :edit, -> { Internal::Types::Hash[String, Object] }, optional: false, nullable: false
        end
      end
    end
  end
end
