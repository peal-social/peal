# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class ArticleState < Internal::Types::Model
      extend Peal::Internal::Types::Union

      discriminant :_tag

      member -> { Peal::Types::ArticleStateDraft }, key: "draft"

      member -> { Peal::Types::ArticleStateScheduled }, key: "scheduled"

      member -> { Peal::Types::ArticleStatePublishing }, key: "publishing"

      member -> { Peal::Types::ArticleStatePublished }, key: "published"

      member -> { Peal::Types::ArticleStateFailed }, key: "failed"

      member -> { Peal::Types::ArticleStateUnconfirmed }, key: "unconfirmed"
    end
  end
end
