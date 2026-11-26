# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class PostRefusal < Internal::Types::Model
      extend Peal::Internal::Types::Union

      discriminant :_tag

      member -> { Peal::Types::PostContentInvalidEncoded }, key: "PostContentInvalid"

      member -> { Peal::Types::UnknownChannelsEncoded }, key: "UnknownChannels"

      member -> { Peal::Types::UnknownMediaEncoded }, key: "UnknownMedia"

      member -> { Peal::Types::ScheduleInPastEncoded }, key: "ScheduleInPast"

      member -> { Peal::Types::InvalidTimeZoneEncoded }, key: "InvalidTimeZone"

      member -> { Peal::Types::PlanLimitReachedEncoded }, key: "PlanLimitReached"

      member -> { Peal::Types::IdempotencyKeyReusedEncoded }, key: "IdempotencyKeyReused"

      member -> { Peal::Types::PostNotFoundEncoded }, key: "PostNotFound"

      member -> { Peal::Types::DuplicatePostEncoded }, key: "DuplicatePost"

      member -> { Peal::Types::ForbiddenEncoded }, key: "Forbidden"

      member -> { Peal::Types::UnknownTagsEncoded }, key: "UnknownTags"

      member -> { Peal::Types::ChannelSetNotFoundEncoded }, key: "ChannelSetNotFound"

      member -> { Peal::Types::SignatureNotFoundEncoded }, key: "SignatureNotFound"

      member -> { Peal::Types::QueueNotFoundEncoded }, key: "QueueNotFound"

      member -> { Peal::Types::QueueHasNoRoomEncoded }, key: "QueueHasNoRoom"

      member -> { Peal::Types::PostExternalIDTakenEncoded }, key: "PostExternalIdTaken"
    end
  end
end
