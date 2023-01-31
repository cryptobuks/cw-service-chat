module.exports = {
  globalMessagesIndex: 'global_messages',
  channels: ['chat', 'plugin', 'device', 'email', 'book', 'ask', 'system'],
  messageType: ['text', 'image', 'action', 'email', 'audio', 'file'],
  clickTypes: ['link', 'audio', 'download', 'image', 'action'],
  truncateLength: 1500,
  maxMessageLength: 10000,
  systemChatId: '000000000000000000000000',
  chatPluginSessionExpiryInSeconds: 7 * 24 * 60 * 60,
  reactions: [{
    id: 'like',
    image: 'like.svg',
    key: 'reaction.like'
  }, {
    id: 'dislike',
    image: 'dislike.svg',
    key: 'reaction.dislike'
  }, {
    id: 'love',
    image: 'love.svg',
    key: 'reaction.love'
  }, {
    id: 'laugh',
    image: 'laugh.svg',
    key: 'reaction.laugh'
  }, {
    id: 'wow',
    image: 'wow.svg',
    key: 'reaction.wow'
  }, {
    id: 'sad',
    image: 'sad.svg',
    key: 'reaction.sad'
  }, {
    id: 'angry',
    image: 'angry.svg',
    key: 'reaction.angry'
  }]
}
