# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class UploadTarget < Internal::Types::Model
      extend Peal::Internal::Types::Union

      discriminant :_tag

      member -> { Peal::Types::UploadTargetSingle }, key: "single"

      member -> { Peal::Types::UploadTargetMultipart }, key: "multipart"
    end
  end
end
