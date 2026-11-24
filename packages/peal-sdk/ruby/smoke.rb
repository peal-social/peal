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
# stand-in checks, and the answer's comes back typed.
signature = peal.posts.signatures.create(
  name: "Studio",
  text: "Sent with Peal",
  scope: Peal::Types::SignatureScopeChannel.new(channel_id: "channel-1")
)

unless signature.scope.is_a?(Peal::Types::SignatureScopeChannel) && signature.scope.channel_id == "channel-1"
  abort "Unexpected signature: #{signature.inspect}"
end

begin
  Peal::Client.new(base_url: base_url, token: "refused").credential.get
  abort "A refused token got an answer"
rescue Peal::Errors::UnauthorizedError
  # The 401 the stand-in answers a refused token.
end

puts "ok"
