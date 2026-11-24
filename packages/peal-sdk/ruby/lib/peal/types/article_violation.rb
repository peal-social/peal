# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class ArticleViolation < Internal::Types::Model
      extend Peal::Internal::Types::Union

      discriminant :_tag

      member -> { Peal::Types::ArticleViolationTitleMissing }, key: "titleMissing"

      member -> { Peal::Types::ArticleViolationTitleTooLong }, key: "titleTooLong"

      member -> { Peal::Types::ArticleViolationBodyMissing }, key: "bodyMissing"

      member -> { Peal::Types::ArticleViolationBodyInvalid }, key: "bodyInvalid"

      member -> { Peal::Types::ArticleViolationExcerptTooLong }, key: "excerptTooLong"

      member -> { Peal::Types::ArticleViolationTooManyTerms }, key: "tooManyTerms"

      member -> { Peal::Types::ArticleViolationTermInvalid }, key: "termInvalid"

      member -> { Peal::Types::ArticleViolationSiteTimeInPast }, key: "siteTimeInPast"

      member -> { Peal::Types::ArticleViolationSiteStatusNotTaken }, key: "siteStatusNotTaken"

      member -> { Peal::Types::ArticleViolationTimeInPast }, key: "timeInPast"

      member -> { Peal::Types::ArticleViolationCoverNotImage }, key: "coverNotImage"

      member -> { Peal::Types::ArticleViolationApprovalRequired }, key: "approvalRequired"
    end
  end
end
