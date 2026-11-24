# frozen_string_literal: true

module Peal
  module Articles
    module Types
      class ListArticlesRequest < Internal::Types::Model
        field :cursor, -> { String }, optional: true, nullable: false

        field :limit, -> { String }, optional: true, nullable: false

        field :status, -> { Peal::Types::ArticleStateName }, optional: true, nullable: false
      end
    end
  end
end
