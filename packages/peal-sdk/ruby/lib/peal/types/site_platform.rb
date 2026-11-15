# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    module SitePlatform
      extend Peal::Internal::Types::Enum

      WORDPRESS = "wordpress"
      DEVTO = "devto"
      HASHNODE = "hashnode"
      WORDPRESS_COM = "wordpressCom"
    end
  end
end
