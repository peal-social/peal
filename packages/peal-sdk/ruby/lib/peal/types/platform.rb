# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    module Platform
      extend Peal::Internal::Types::Enum

      X = "x"
      LINKEDIN = "linkedin"
      BLUESKY = "bluesky"
      MASTODON = "mastodon"
      THREADS = "threads"
      INSTAGRAM = "instagram"
      FACEBOOK = "facebook"
      TIKTOK = "tiktok"
      YOUTUBE = "youtube"
      PINTEREST = "pinterest"
      GOOGLE_BUSINESS = "googleBusiness"
      DISCORD = "discord"
      TELEGRAM = "telegram"
      SLACK = "slack"
      SNAPCHAT = "snapchat"
      WORDPRESS = "wordpress"
      DEVTO = "devto"
      HASHNODE = "hashnode"
      WORDPRESS_COM = "wordpressCom"
    end
  end
end
