# frozen_string_literal: true

module Peal
  module Slideshows
    class Client
      # @param client [Peal::Internal::Http::RawClient]
      #
      # @return [void]
      def initialize(client:)
        @client = client
      end

      # Lists the slide videos the workspace asked for, newest first, 50 at most, only those with `status` when given.
      # Needs assistant:use.
      #
      # @param request_options [Hash]
      # @param params [Hash]
      # @option request_options [String] :base_url
      # @option request_options [Hash{String => Object}] :additional_headers
      # @option request_options [Hash{String => Object}] :additional_query_parameters
      # @option request_options [Hash{String => Object}] :additional_body_parameters
      # @option request_options [Integer] :timeout_in_seconds
      # @option params [Peal::Types::SlideshowStatus, nil] :status
      #
      # @example
      #   client.slideshows.list
      #
      # @return [Peal::Types::Slideshows]
      def list(request_options: {}, **params)
        params = Peal::Internal::Types::Utils.normalize_keys(params)
        query_params = {}
        query_params["status"] = params[:status] if params.key?(:status)

        request = Peal::Internal::JSON::Request.new(
          base_url: request_options[:base_url],
          method: "GET",
          path: "api/v1/media/slideshows",
          query: query_params,
          request_options: request_options
        )
        begin
          response = @client.send(request)
        rescue Net::HTTPRequestTimeout
          raise Peal::Errors::TimeoutError
        end
        code = response.code.to_i
        if code.between?(200, 299)
          (response.body.to_s.empty? ? nil : Peal::Types::Slideshows.load(response.body))
        else
          error_class = Peal::Errors::ResponseError.subclass_for_code(code)
          error_types = {
            401 => Peal::Types::UnauthenticatedEncoded
          }
          error_body = Peal::Errors::ResponseError.load_error_body(code, response.body, error_types)
          raise error_class.new(response.body, code: code, body: error_body, headers: response.to_hash)
        end
      end

      # Asks the service the workspace chose for slide videos (`PUT .../assistant/models/composition`, Shotstack) to
      # compose 2 to 10 images of its library, in order, each with an optional caption and motion, optionally over a
      # voice-over of its library, in the aspect asked, and answers 202 with the job, `queued`. Each slide lasts
      # `secondsPerSlide`, or the voice-over's length shared between them, 90 seconds at most in all. Follow it with
      # `GET .../media/slideshows/{id}`; once `succeeded`, the video is a file of the media library (`mediaId`, MP4 at
      # 1080p), marked `aiGenerated` when a file it is made of was, and the member who asked is told in the app. The
      # service receives each file through a link that works for an hour, and renders with the workspace's own key,
      # under its terms and at its prices: Peal bills nothing for it. Its sandbox, when the connection names it, is free
      # and watermarks every video. On a server that bills, it needs a payment method on the workspace's billing account
      # (CompositionNeedsPayment). One slide video at a time a workspace (CompositionBusy), 20 a UTC day
      # (CompositionAllowanceReached), whatever each ends with. The plan's media storage must have room for the largest
      # video Peal keeps before anything is asked. A job is never asked again: a server that stops while it is composed
      # fails it (`interrupted`). Neither the captions nor the video are logged, and the captions are kept only while
      # the video is composed. Needs assistant:use and media:upload.
      #
      # @param request_options [Hash]
      # @param params [Peal::Slideshows::Types::SlideshowRequest]
      # @option request_options [String] :base_url
      # @option request_options [Hash{String => Object}] :additional_headers
      # @option request_options [Hash{String => Object}] :additional_query_parameters
      # @option request_options [Hash{String => Object}] :additional_body_parameters
      # @option request_options [Integer] :timeout_in_seconds
      #
      # @example
      #   client.slideshows.create(
      #     aspect: "square",
      #     slides: [{
      #       mediaId: "mediaId"
      #     }]
      #   )
      #
      # @return [Peal::Types::Slideshow]
      def create(request_options: {}, **params)
        params = Peal::Internal::Types::Utils.normalize_keys(params)
        request = Peal::Internal::JSON::Request.new(
          base_url: request_options[:base_url],
          method: "POST",
          path: "api/v1/media/slideshows",
          body: Peal::Slideshows::Types::SlideshowRequest.new(params).to_h,
          request_options: request_options,
          max_retries: 0
        )
        begin
          response = @client.send(request)
        rescue Net::HTTPRequestTimeout
          raise Peal::Errors::TimeoutError
        end
        code = response.code.to_i
        if code.between?(200, 299)
          (response.body.to_s.empty? ? nil : Peal::Types::Slideshow.load(response.body))
        else
          error_class = Peal::Errors::ResponseError.subclass_for_code(code)
          error_types = {
            401 => Peal::Types::UnauthenticatedEncoded
          }
          error_body = Peal::Errors::ResponseError.load_error_body(code, response.body, error_types)
          raise error_class.new(response.body, code: code, body: error_body, headers: response.to_hash)
        end
      end

      # Asks the service the workspace chose for slide videos (`PUT .../assistant/models/composition`, Shotstack) to
      # render a whole [Shotstack Edit](https://shotstack.io/docs/api/#tocs_edit), as a video editor writes it, with the
      # workspace's own Shotstack connection, and answers 202 with the job, `queued`, as a slide video's. A file of the
      # workspace's library is named `peal:media/<mediaId>`: a ready file whose kind its asset takes (images for image
      # assets, videos for video assets, audio for audio assets and the soundtrack, audio or video for captions, an
      # image or a video for a luma matte); a font may also come from `https://fonts.gstatic.com/`; an asset Shotstack
      # generates from a `prompt` needs no file; any other address is refused, and so are merge fields. Peal renders an
      # MP4 (`format` `mp4` or none), at `preview`, `mobile`, `sd`, `hd` or `1080` (none: 1080p), in 16:9, 9:16 or 1:1
      # (none: 16:9, which gives the job's `aspect`), at 30 frames a second at most, without `size`, `range`, `scaleTo`,
      # `repeat`, `poster` or `thumbnail`; it replaces the destinations, so Shotstack hosts no copy, turns the
      # timeline's cache off and drops `callback` and `disk`. At most 20 tracks and 200 clips, and every clip whose
      # start and length are numbers ends by 300 seconds (`durationSeconds` is the latest such end). The job lists every
      # library file the edit names in `imageMediaIds`, images or not. Follow it with `GET .../media/slideshows/{id}`;
      # once `succeeded`, the video is a file of the media library. The service receives each file through a link that
      # works for an hour and renders with the workspace's own key, under its terms and at its prices: Peal bills
      # nothing for it. On a server that bills, it needs a payment method on the workspace's billing account
      # (CompositionNeedsPayment). One job at a time a workspace (CompositionBusy) and 20 a UTC day
      # (CompositionAllowanceReached), shared with slide videos, whatever each ends with. The edit is never logged, and
      # is kept only while the video is rendered. Needs assistant:use and media:upload.
      #
      # @param request_options [Hash]
      # @param params [Peal::Slideshows::Types::EditRenderRequest]
      # @option request_options [String] :base_url
      # @option request_options [Hash{String => Object}] :additional_headers
      # @option request_options [Hash{String => Object}] :additional_query_parameters
      # @option request_options [Hash{String => Object}] :additional_body_parameters
      # @option request_options [Integer] :timeout_in_seconds
      #
      # @example
      #   client.slideshows.create_from_edit(edit: {
      #     key: "value"
      #   })
      #
      # @return [Peal::Types::Slideshow]
      def create_from_edit(request_options: {}, **params)
        params = Peal::Internal::Types::Utils.normalize_keys(params)
        request = Peal::Internal::JSON::Request.new(
          base_url: request_options[:base_url],
          method: "POST",
          path: "api/v1/media/slideshows/edits",
          body: Peal::Slideshows::Types::EditRenderRequest.new(params).to_h,
          request_options: request_options,
          max_retries: 0
        )
        begin
          response = @client.send(request)
        rescue Net::HTTPRequestTimeout
          raise Peal::Errors::TimeoutError
        end
        code = response.code.to_i
        if code.between?(200, 299)
          (response.body.to_s.empty? ? nil : Peal::Types::Slideshow.load(response.body))
        else
          error_class = Peal::Errors::ResponseError.subclass_for_code(code)
          error_types = {
            401 => Peal::Types::UnauthenticatedEncoded
          }
          error_body = Peal::Errors::ResponseError.load_error_body(code, response.body, error_types)
          raise error_class.new(response.body, code: code, body: error_body, headers: response.to_hash)
        end
      end

      # Reads where a slide video stands: queued, running, succeeded with its file (`mediaId`), or failed with why
      # (`reason`). Needs assistant:use.
      #
      # @param request_options [Hash]
      # @param params [Hash]
      # @option request_options [String] :base_url
      # @option request_options [Hash{String => Object}] :additional_headers
      # @option request_options [Hash{String => Object}] :additional_query_parameters
      # @option request_options [Hash{String => Object}] :additional_body_parameters
      # @option request_options [Integer] :timeout_in_seconds
      # @option params [String] :slideshow_id
      #
      # @example
      #   client.slideshows.get(slideshow_id: "slideshowId")
      #
      # @return [Peal::Types::Slideshow]
      def get(request_options: {}, **params)
        params = Peal::Internal::Types::Utils.normalize_keys(params)
        request = Peal::Internal::JSON::Request.new(
          base_url: request_options[:base_url],
          method: "GET",
          path: "api/v1/media/slideshows/#{URI.encode_uri_component(params[:slideshow_id].to_s)}",
          request_options: request_options
        )
        begin
          response = @client.send(request)
        rescue Net::HTTPRequestTimeout
          raise Peal::Errors::TimeoutError
        end
        code = response.code.to_i
        if code.between?(200, 299)
          (response.body.to_s.empty? ? nil : Peal::Types::Slideshow.load(response.body))
        else
          error_class = Peal::Errors::ResponseError.subclass_for_code(code)
          error_types = {
            401 => Peal::Types::UnauthenticatedEncoded
          }
          error_body = Peal::Errors::ResponseError.load_error_body(code, response.body, error_types)
          raise error_class.new(response.body, code: code, body: error_body, headers: response.to_hash)
        end
      end
    end
  end
end
