# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class ContentViolation < Internal::Types::Model
      extend Peal::Internal::Types::Union

      discriminant :_tag

      member -> { Peal::Types::ContentViolationNoChannels }, key: "noChannels"

      member -> { Peal::Types::ContentViolationOverrideWithoutChannel }, key: "overrideWithoutChannel"

      member -> { Peal::Types::ContentViolationOptionsWithoutChannel }, key: "optionsWithoutChannel"

      member -> { Peal::Types::ContentViolationOptionsForOtherPlatform }, key: "optionsForOtherPlatform"

      member -> { Peal::Types::ContentViolationOptionMissing }, key: "optionMissing"

      member -> { Peal::Types::ContentViolationOptionTooLong }, key: "optionTooLong"

      member -> { Peal::Types::ContentViolationOptionInvalid }, key: "optionInvalid"

      member -> { Peal::Types::ContentViolationEmpty }, key: "empty"

      member -> { Peal::Types::ContentViolationTextTooLong }, key: "textTooLong"

      member -> { Peal::Types::ContentViolationForbiddenCharacters }, key: "forbiddenCharacters"

      member -> { Peal::Types::ContentViolationTooManyMedia }, key: "tooManyMedia"

      member -> { Peal::Types::ContentViolationTooManyParts }, key: "tooManyParts"

      member -> { Peal::Types::ContentViolationPartsNeedReconnect }, key: "partsNeedReconnect"

      member -> { Peal::Types::ContentViolationCommentsTurnedOff }, key: "commentsTurnedOff"

      member -> { Peal::Types::ContentViolationPollNotSupported }, key: "pollNotSupported"

      member -> { Peal::Types::ContentViolationPollChoiceCount }, key: "pollChoiceCount"

      member -> { Peal::Types::ContentViolationPollChoiceLength }, key: "pollChoiceLength"

      member -> { Peal::Types::ContentViolationPollChoiceRepeated }, key: "pollChoiceRepeated"

      member -> { Peal::Types::ContentViolationPollDurationOutOfRange }, key: "pollDurationOutOfRange"

      member -> { Peal::Types::ContentViolationPollMultipleChoice }, key: "pollMultipleChoice"

      member -> { Peal::Types::ContentViolationPollWithMedia }, key: "pollWithMedia"

      member -> { Peal::Types::ContentViolationMediaRequired }, key: "mediaRequired"

      member -> { Peal::Types::ContentViolationTooManyHashtags }, key: "tooManyHashtags"

      member -> { Peal::Types::ContentViolationTooManyMentions }, key: "tooManyMentions"

      member -> { Peal::Types::ContentViolationTooManyLinks }, key: "tooManyLinks"

      member -> { Peal::Types::ContentViolationTooManyVideos }, key: "tooManyVideos"

      member -> { Peal::Types::ContentViolationMixedMedia }, key: "mixedMedia"

      member -> { Peal::Types::ContentViolationMediaTypeUnsupported }, key: "mediaTypeUnsupported"

      member -> { Peal::Types::ContentViolationMediaTooLarge }, key: "mediaTooLarge"

      member -> { Peal::Types::ContentViolationMediaTooSmall }, key: "mediaTooSmall"

      member -> { Peal::Types::ContentViolationVideoTooLong }, key: "videoTooLong"

      member -> { Peal::Types::ContentViolationVideoTooShort }, key: "videoTooShort"

      member -> { Peal::Types::ContentViolationTooManyPixels }, key: "tooManyPixels"

      member -> { Peal::Types::ContentViolationSideOutOfRange }, key: "sideOutOfRange"

      member -> { Peal::Types::ContentViolationSideSumTooLarge }, key: "sideSumTooLarge"

      member -> { Peal::Types::ContentViolationMediaTotalTooLarge }, key: "mediaTotalTooLarge"

      member -> { Peal::Types::ContentViolationAspectRatioUnsupported }, key: "aspectRatioUnsupported"

      member -> { Peal::Types::ContentViolationAltTextTooLong }, key: "altTextTooLong"

      member -> { Peal::Types::ContentViolationBodyInvalid }, key: "bodyInvalid"

      member -> { Peal::Types::ContentViolationBodyNotTaken }, key: "bodyNotTaken"

      member -> { Peal::Types::ContentViolationOptionsNotTaken }, key: "optionsNotTaken"
    end
  end
end
