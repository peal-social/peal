# frozen_string_literal: true

# The smoke test, which scripts/test.ts runs against a stand-in API: the
# health check, the credential check with a bearer token, tagged unions
# decoded and sent, and the error a refused token raises.
require "peal"
require "socket"
require "uri"

# The client sends plain HTTP to localhost alone, and the stand-in is on the
# Docker host: a forwarder on this container's loopback carries the bytes.
stand_in = URI(ENV.fetch("PEAL_API_URL"))
forwarder = TCPServer.new("127.0.0.1", 0)

Thread.new do
  loop do
    Thread.new(forwarder.accept) do |client|
      upstream = TCPSocket.new(stand_in.host, stand_in.port)
      [[client, upstream], [upstream, client]].map do |from, to|
        Thread.new do
          IO.copy_stream(from, to)
          to.close_write
        end
      end.each(&:join)
    ensure
      client.close
      upstream&.close
    end
  end
end

base_url = "http://127.0.0.1:#{forwarder.addr[1]}"
peal = Peal::Client.new(base_url: base_url, token: "peal_test")

peal.system.health
credential = peal.credential.get

# A tagged union comes back as the member its `_tag` names.
unless credential.is_a?(Peal::Types::CredentialAPIKey) && credential.workspace.name == "Studio" &&
       credential.expires_at.nil? && credential.start.nil? &&
       credential.permissions.include?("post:schedule")
  abort "Unexpected answer: #{credential.inspect}"
end

# Each channel's status, a union in a list: two members with no field but
# their tag, and one with a field.
statuses = peal.channels.list.map(&:status)

unless statuses.map(&:class) == [Peal::Types::ChannelStatusActive, Peal::Types::ChannelStatusRefreshNeeded,
                                 Peal::Types::ChannelStatusDisabled] &&
       statuses.last.refresh_needed == true
  abort "Unexpected statuses: #{statuses.inspect}"
end

# A union sent as its member's type goes out with its `_tag`, which the
# stand-in checks, and the answer's comes back typed. The member is frozen,
# and the caller's object stays as it was: the SDK tags a copy.
scope = Peal::Types::SignatureScopeChannel.new(channel_id: "channel-1").freeze
signature = peal.posts.signatures.create(name: "Studio", text: "Sent with Peal", scope: scope)

unless signature.scope.is_a?(Peal::Types::SignatureScopeChannel) && signature.scope.channel_id == "channel-1"
  abort "Unexpected signature: #{signature.inspect}"
end

abort "The caller's scope changed: #{scope.to_h.inspect}" unless scope.to_h == { "channelId" => "channel-1" }

# A union that is the request's whole body keeps its fields' API names,
# discriminated (a chat, by `platform`) or not (a redelivery).
chat = peal.channels.connect_chat(platform: "telegram", bot_token: "synthetic-telegram-bot-token", chat: "@studio")

abort "Unexpected chat: #{chat.inspect}" unless chat.status.is_a?(Peal::Types::ChannelStatusActive)

redelivery = peal.webhooks.redeliver_many(delivery_ids: ["delivery-1"])

abort "Unexpected redelivery: #{redelivery.inspect}" unless redelivery.remaining.zero?

# A member set after its model is built records its tag as one given to
# the constructor does.
options = Peal::Types::ChannelOptions.new(channel_id: "channel-1")
options.options = Peal::Types::YouTubeOptions.new(title: "Launch")

unless options.to_h == { "channelId" => "channel-1", "options" => { "title" => "Launch", "platform" => "youtube" } }
  abort "Unexpected options: #{options.to_h.inspect}"
end

begin
  Peal::Client.new(base_url: base_url, token: "refused").credential.get
  abort "A refused token got an answer"
rescue Peal::Errors::UnauthorizedError
  # The 401 the stand-in answers a refused token.
end

puts "ok"
