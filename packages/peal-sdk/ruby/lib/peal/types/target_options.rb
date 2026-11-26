# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    # What a post says on a channel that only its platform knows, tagged by `platform`. Platforms without options take
    # none.
    class TargetOptions < Internal::Types::Model
      extend Peal::Internal::Types::Union

      discriminant :platform

      member -> { Peal::Types::YouTubeOptions }, key: "youtube"

      member -> { Peal::Types::TikTokOptions }, key: "tiktok"

      member -> { Peal::Types::PinterestOptions }, key: "pinterest"

      member -> { Peal::Types::GoogleBusinessOptions }, key: "googleBusiness"

      member -> { Peal::Types::LinkedInOptions }, key: "linkedin"

      member -> { Peal::Types::MastodonOptions }, key: "mastodon"

      member -> { Peal::Types::BlueskyOptions }, key: "bluesky"

      member -> { Peal::Types::ThreadsOptions }, key: "threads"

      member -> { Peal::Types::XOptions }, key: "x"

      member -> { Peal::Types::InstagramOptions }, key: "instagram"

      member -> { Peal::Types::FacebookOptions }, key: "facebook"

      member -> { Peal::Types::DiscordOptions }, key: "discord"

      member -> { Peal::Types::TelegramOptions }, key: "telegram"

      member -> { Peal::Types::SlackOptions }, key: "slack"

      member -> { Peal::Types::SnapchatOptions }, key: "snapchat"
    end
  end
end
