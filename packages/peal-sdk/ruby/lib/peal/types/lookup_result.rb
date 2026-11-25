# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class LookupResult < Internal::Types::Model
      extend Peal::Internal::Types::Union

      discriminant :_tag

      member -> { Peal::Types::LookupResultYoutubeVideoCategories }, key: "youtubeVideoCategories"

      member -> { Peal::Types::LookupResultYoutubePlaylists }, key: "youtubePlaylists"

      member -> { Peal::Types::LookupResultTiktokCreator }, key: "tiktokCreator"

      member -> { Peal::Types::LookupResultPinterestBoards }, key: "pinterestBoards"

      member -> { Peal::Types::LookupResultPinterestBoardSections }, key: "pinterestBoardSections"

      member -> { Peal::Types::LookupResultLinkedinOrganizations }, key: "linkedinOrganizations"
    end
  end
end
