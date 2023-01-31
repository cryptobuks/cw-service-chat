const { db, ctr, es, envPrefix, log, _, rabbitmq } = require('@cowellness/cw-micro-service')()
const messagesConstants = require('../message/message.constants')
const chatConstants = require('../chat/chat.constants')
/**
 * @class GroupMessageController
 * @classdesc Controller GroupMessage
 */
class GroupMessageController {
  constructor () {
    this.GroupMessage = db.chat.model('GroupMessage')
  }

  /**
   * check if a user is allowed access to group
   * @param {*} data {chatId}
   * @returns boolean
   */
  async isAllowedAccess ({ _user, chatId }) {
    const group = await ctr.group.getGroup({ _user, chatId })

    if (!group) {
      return false
    }

    return true
  }

  /**
   * Fetch all messages in a group
   * @param {Object} data
   * @return messages
   */
  async getGroupMessages ({ _user, chatId, limit = 50 }) {
    const isAllowedAccess = await this.isAllowedAccess({ _user, chatId })

    if (!isAllowedAccess) {
      return null
    }
    const filter = {
      $or: [
        { fromProfileId: _user.profileId, chatId },
        { chatId, toProfileIds: _user.profileId }
      ]
    }

    const messages = await this.GroupMessage.find(filter).populate('_replyToMessage').sort({ createdAt: -1 }).limit(limit).lean()
    return messages.map(message => this.truncateMessage(message))
  }

  /**
   * Get Old messages
   * @param {*} data
   * @returns old messages
   */
  async getOldestMessages ({ _user, chatId, limit = 50, toMessageId }) {
    const isAllowedAccess = await this.isAllowedAccess({ _user, chatId })

    if (!isAllowedAccess) {
      return null
    }
    const filter = {
      $or: [
        { fromProfileId: _user.profileId, chatId },
        { chatId, toProfileIds: _user.profileId }
      ]
    }
    const toMessage = await this.GroupMessage.findOne({ _id: toMessageId })

    if (toMessage) {
      _.set(filter, 'createdAt.$lte', toMessage.createdAt)
    }
    const messages = await this.GroupMessage.find(filter).populate('_replyToMessage').sort({ createdAt: -1 }).limit(limit).lean()

    return messages.map(message => this.truncateMessage(message))
  }

  /**
   * Get latest messages
   * @param {*} data
   * @returns latest messages
   */
  async getLatestMessages ({ _user, chatId, limit = 50, fromMessageId }) {
    const isAllowedAccess = await this.isAllowedAccess({ _user, chatId })

    if (!isAllowedAccess) {
      return null
    }
    const filter = {
      $or: [
        { fromProfileId: _user.profileId, chatId },
        { chatId, toProfileIds: _user.profileId }
      ]
    }
    if (fromMessageId) {
      const fromMessage = await this.GroupMessage.findOne({ chatId, _id: fromMessageId })

      if (fromMessage) {
        _.set(filter, 'createdAt.$gte', fromMessage.createdAt)
      }
    }
    const messages = await this.GroupMessage.find(filter).populate('_replyToMessage').sort({ createdAt: 1 }).limit(limit).lean()

    return _.orderBy(messages.map(message => this.truncateMessage(message)), 'createdAt', 'desc')
  }

  /**
   * Get a searched message by id
   * @param {*} data
   * @returns old messages and latest messages from inputed message id
   */
  async getSearchedMessages ({ _user, chatId, limit = 50, searchedMessageId }) {
    const splitLimit = Math.ceil(limit / 2)
    const oldestMessages = await this.getOldestMessages({
      _user,
      chatId,
      limit: splitLimit,
      toMessageId: searchedMessageId
    })
    const latestMessages = await this.getLatestMessages({
      _user,
      chatId,
      limit: splitLimit,
      fromMessageId: searchedMessageId
    })

    return _.chain([...latestMessages, ...oldestMessages])
      .unionBy(item => item._id.toString())
      .orderBy('createdAt', 'desc')
  }

  /**
   * remove unnecessary properties
   * @param {*} message
   * @returns truncated message
   */
  truncateMessage (message) {
    if (message.content.text) {
      const textLength = message.content.text.length

      message.content.text = message.content.text.slice(0, messagesConstants.truncateLength)
      if (message.content.text.length !== textLength) {
        message.content.isTruncated = true
      }
    }

    if (message._replyToMessage) {
      message._replyToMessage = ctr.message.reduceFieldsMessage(this.truncateMessage(message._replyToMessage))
    }
    if (message.isDeleted) {
      message.content = null
    }
    return message
  }

  /**
   * Create a message in a group
   * @param {Object} data
   * @return message
   */
  async createGroupMessage ({ _user, chatId, content, frontId }) {
    const { profileId, managerId } = _user
    const fromProfileId = profileId
    const fromManagerProfileId = managerId || null
    const group = await ctr.group.getGroup({ _user, chatId })

    if (!group) {
      return null
    }
    const existingMessage = await this.GroupMessage.findOne({ frontId, chatId, fromProfileId })

    if (existingMessage) {
      return existingMessage
    }
    if (content.type === 'image') {
      const imageData = await ctr.message.uploadImage(content.base64)

      content.imageId = imageData._id
      content.imageUrl = imageData.url
    }
    let toProfileIds = group.members.filter(member => member.status === 'active').map(member => member.profileId)
    // prevent creating message from inactive profile
    const isProfileActive = await ctr.chat.filterActiveProfiles([fromProfileId])

    if (!isProfileActive.length) {
      throw new Error('Account inactive')
    }
    // filter active/ temporary profiles
    toProfileIds = await ctr.chat.filterActiveProfiles(toProfileIds)
    // filter active/ temporary relations
    toProfileIds = await ctr.chat.filterActiveRelations(group.ownerId, toProfileIds)
    toProfileIds.push(group.ownerId)
    const message = await this.GroupMessage.create({
      frontId,
      channel: 'group',
      chatId,
      groupId: group._id,
      fromProfileId,
      fromManagerProfileId,
      toProfileIds,
      content
    })
    this.pushMessage({ _user, message })
    return message
  }

  /**
   * Get last message in a group
   * @param {*} groupId
   * @returns last message
   */
  lastMessage (groupId) {
    return this.GroupMessage.findOne({
      groupId
    }, {}, { sort: { createdAt: -1 } })
  }

  /**
   * Update group messages ES index
   * @param groupMessage
   */
  async updateEsIndex (groupMessage) {
    const body = {
      id: groupMessage._id,
      type: 'group',
      frontId: groupMessage.frontId,
      chatId: `G-${groupMessage.groupId}`,
      channel: groupMessage.channel,
      fromProfileId: groupMessage.fromProfileId,
      fromManagerProfileId: groupMessage.fromManagerProfileId,
      toProfileIds: groupMessage.toProfileIds,
      content: {
        text: groupMessage.content.text,
        subject: null
      },
      createdAt: groupMessage.createdAt,
      updatedAt: groupMessage.updatedAt
    }
    await this.updateGroupEsIndex(groupMessage)
    return es.index({
      index: envPrefix + messagesConstants.globalMessagesIndex,
      id: `G-${groupMessage._id}`,
      body: body
    })
  }

  /**
   * Update group ES index
   * @param {*} groupMessage
   */
  async updateGroupEsIndex (groupMessage) {
    const groupId = `G-${groupMessage.groupId}`
    const lastMessage = await this.lastMessage(groupMessage.groupId)
    const result = await es.updateByQuery({
      index: envPrefix + chatConstants.globalChatsIndex,
      conflicts: 'proceed',
      body: {
        script: {
          source: `
            if (!ctx._source.containsKey('firstMessage') || ctx._source.firstMessage == null) ctx._source.firstMessage = params.lastMessage;
            ctx._source.lastMessage = params.lastMessage;
            ctx._source.toProfileIds = params.toProfileIds;
            ctx._source.updatedAt = params.lastMessage.createdAt;
          `,
          params: {
            lastMessage,
            toProfileIds: groupMessage.toProfileIds
          },
          lang: 'painless'
        },
        query: {
          bool: {
            must: [
              {
                match: {
                  id: groupId
                }
              }
            ]
          }
        }
      }
    })
    log.info('Updated group message')
    log.info(result)
    return !!result.updated
  }

  /**
   * set message as viewed
   * @param {*} data {messageId}
   * @returns groupMessage
   */
  async setMessageView ({ _user, messageId }) {
    const message = await this.GroupMessage.findOne({ _id: messageId, toProfileIds: _user.profileId })

    if (!message) {
      return null
    }
    const hasViewed = message.views.find(v => v.profileId === _user.profileId)

    if (!hasViewed) {
      message.isViewed = true
      message.viewedAt = Date.now()
      message.views.push({
        profileId: _user.profileId
      })
      await message.save()
    }
    await this.setPreviousMessagesViewed(message.groupId, _user.profileId, message.createdAt)
    await this.pushMessage({ _user, message })
    return message
  }

  /**
   * Add reaction to message
   * @param {Object} data {messageId, reactionId}
   * @returns modified message
   */
  async setMessageReaction ({ _user, messageId, reactionId }) {
    const message = await this.GroupMessage.findOne({ _id: messageId, toProfileIds: _user.profileId })

    if (!message) {
      return null
    }
    const hasReacted = message.reactions.find(reaction => reaction.profileId === _user.profileId && reaction.reactionId === reactionId)

    if (!hasReacted) {
      message.reactions.push({
        profileId: _user.profileId,
        reactionId
      })
    }

    await message.save()
    await this.pushMessage({ _user, message })
    return message
  }

  /**
   * Push a message to users through ws
   * @param {*} data
   * @returns sent message
   */
  async pushMessage ({ _user, message }) {
    const destination = {
      _user,
      toProfileIds: message.toProfileIds,
      msgObj: {
        service: 'chat',
        module: 'groupMessage',
        action: 'setMessage',
        payload: {
          data: {
            profileId: message.fromProfileId,
            message
          }
        }
      }
    }

    const { data } = await rabbitmq.sendAndRead('/ws/send', destination)

    return data
  }

  /**
   * Set all previous messages to be viewed
   * @param {Object} data
   * @returns modified message
   */
  async setPreviousMessagesViewed (groupId, toProfileId, createdAt) {
    const messages = await this.GroupMessage.find({
      toProfileIds: toProfileId,
      groupId,
      createdAt: {
        $lte: createdAt
      },
      'views.profileId': {
        $ne: toProfileId
      }
    })
    const updated = messages.map(message => {
      message.isViewed = true
      message.viewedAt = Date.now()
      message.views.push({
        profileId: toProfileId
      })
      return message.save().then(() => {
        this.pushMessage({ message })
      })
    })
    return Promise.all(updated)
  }
}

module.exports = GroupMessageController
