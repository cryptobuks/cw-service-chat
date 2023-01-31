const { db, ctr, es, envPrefix, log, _, rabbitmq } = require('@cowellness/cw-micro-service')()
const messagesConstants = require('../message/message.constants')
const chatConstants = require('../chat/chat.constants')
/**
 * @class BroadcastmessageController
 * @classdesc Controller Broadcastmessage
 */
class BroadcastmessageController {
  constructor () {
    this.Broadcastmessage = db.chat.model('Broadcastmessage')
  }

  /**
   * Lists broadcast messages
   * @param {Object} param0 {chatId}
   * @returns {Array} broadcast messages
   */
  async getBroadcastMessages ({ _user, chatId, limit = 50 }) {
    const filter = {
      $or: [
        { fromProfileId: _user.profileId, chatId },
        { chatId, toProfileIds: _user.profileId }
      ]
    }

    const messages = await this.Broadcastmessage.find(filter).sort({ createdAt: -1 }).limit(limit).lean()
    return messages.map(message => this.truncateMessage(message))
  }

  /**
   * Get Old messages
   * @param {*} data
   * @returns old messages
   */
  async getOldestMessages ({ _user, chatId, limit = 50, toMessageId }) {
    const filter = {
      $or: [
        { fromProfileId: _user.profileId, chatId },
        { chatId, toProfileIds: _user.profileId }
      ]
    }
    const toMessage = await this.Broadcastmessage.findOne({ _id: toMessageId })

    if (toMessage) {
      _.set(filter, 'createdAt.$lte', toMessage.createdAt)
    }
    const messages = await this.Broadcastmessage.find(filter).sort({ createdAt: -1 }).limit(limit).lean()

    return messages.map(message => this.truncateMessage(message))
  }

  /**
   * Get latest messages
   * @param {*} data
   * @returns latest messages
   */
  async getLatestMessages ({ _user, chatId, limit = 50, fromMessageId }) {
    const filter = {
      $or: [
        { fromProfileId: _user.profileId, chatId },
        { chatId, toProfileIds: _user.profileId }
      ]
    }
    if (fromMessageId) {
      const fromMessage = await this.Broadcastmessage.findOne({ chatId, _id: fromMessageId })

      if (fromMessage) {
        _.set(filter, 'createdAt.$gte', fromMessage.createdAt)
      }
    }
    const messages = await this.Broadcastmessage.find(filter).sort({ createdAt: 1 }).limit(limit).lean()

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

    if (message.isDeleted) {
      message.content = null
    }
    return message
  }

  /**
   * Creates a broadcast message
   * @param {Object} param0 {chatId, content, frontId}
   * @returns {Object} created broadcast message object
   */
  async createBroadcastMessage ({ _user, chatId, content, frontId }, auth) {
    const { profileId, managerId } = _user
    const fromProfileId = profileId
    const fromManagerProfileId = managerId || null

    const broadcast = await ctr.broadcast.getBroadcast({ _user, chatId })

    if (!broadcast) {
      return null
    }

    let toProfileIds = broadcast.members.filter(member => member.status === 'active').map(member => member.profileId)
    const isSalesman = await auth.isSalesman()
    const canViewAllProfile = _.get(_user, 'permission.businessContacts.viewAllProfile')

    if (isSalesman && managerId === broadcast.managedBy && !canViewAllProfile) {
      const { data: assignedProfiles } = await rabbitmq.sendAndRead('/auth/relation/assigned', {
        businessId: profileId,
        profileIds: [managerId]
      })
      const relatedProfileIds = []
      assignedProfiles.forEach(item => {
        relatedProfileIds.push(...item.relatedProfiles.map(related => related.profileId._id))
      })
      toProfileIds.push(...relatedProfileIds)
    }
    // prevent creating message from inactive profile
    const isProfileActive = await ctr.chat.filterActiveProfiles([fromProfileId])

    if (!isProfileActive.length) {
      throw new Error('Account inactive')
    }
    // filter active/ temporary profiles
    toProfileIds = await ctr.chat.filterActiveProfiles(toProfileIds)
    // filter active/ temporary relations
    toProfileIds = await ctr.chat.filterActiveRelations(broadcast.ownerId, toProfileIds)

    if (!toProfileIds.length) {
      throw new Error('No profiles to send to')
    }
    if (content.base64) {
      if (content.type === 'image') {
        const imageData = await ctr.message.uploadImage(content.base64, content.filename)

        content.imageId = imageData._id
        content.filename = imageData.filename
        content.mimeType = imageData.mimeType
        content.size = imageData.size
        content.base64 = null
      }
      if (content.type === 'audio') {
        const audioData = await ctr.message.uploadMedia(content.base64, content.filename)

        content.audioId = audioData._id
        content.filename = audioData.filename
        content.mimeType = audioData.mimeType
        content.size = audioData.size
        content.base64 = null
      }
      if (content.type === 'file') {
        const fileData = await ctr.message.uploadMedia(content.base64, content.filename)

        content.fileId = fileData._id
        content.filename = fileData.filename
        content.mimeType = fileData.mimeType
        content.size = fileData.size
        content.base64 = null
      }
    }
    const broadcastMessage = await this.Broadcastmessage.create({
      frontId,
      broadcastId: broadcast._id,
      chatId,
      content,
      fromProfileId,
      fromManagerProfileId,
      toProfileIds
    })

    const messages = toProfileIds.map(toProfileId => {
      return ctr.message.createMessage({
        _user,
        toProfileId,
        frontId,
        broadcastMessageId: broadcastMessage._id,
        content
      })
    })

    await Promise.all(messages)

    return broadcastMessage
  }

  /**
   * set message as viewed
   * @param {*} data
   * @returns broadcastMessage
   */
  async setMessageView ({ broadcastMessageId, profileId }) {
    const message = await this.Broadcastmessage.findOne({ _id: broadcastMessageId })

    if (!message) {
      return null
    }
    const hasViewed = message.views.find(view => view.profileId === profileId)

    if (!hasViewed) {
      message.views.push({
        profileId
      })
    }
    return message.save()
  }

  /**
   * set message as clicked
   * @param {*} data
   * @returns broadcastMessage
   */
  async setMessageClick ({ broadcastMessageId, profileId, type, value }) {
    const message = await this.Broadcastmessage.findOne({ _id: broadcastMessageId })

    if (!message) {
      return null
    }
    const hasClicked = message.clicks.find(click => {
      if (click.profileId === profileId && click.type === type) {
        if (click.type === 'link' && click.value !== value) {
          return false
        }
        return true
      }
      return false
    })

    if (!hasClicked) {
      message.clicks.push({
        profileId,
        type,
        value
      })
    }
    return message.save()
  }

  /**
   * set message reaction
   * @param {*} data
   * @returns broadcastMessage
   */
  async setMessageReaction ({ broadcastMessageId, profileId, reactionId }) {
    const message = await this.Broadcastmessage.findOne({ _id: broadcastMessageId })

    if (!message) {
      return null
    }
    const hasReacted = message.reactions.find(reaction => reaction.profileId === profileId && reaction.reactionId === reactionId)

    if (!hasReacted) {
      message.reactions.push({
        profileId,
        reactionId
      })
    }
    return message.save()
  }

  /**
   * Get last message in a broadcast
   * @param {*} broadcastId
   * @returns last message
   */
  lastMessage (broadcastId) {
    return this.Broadcastmessage.findOne({
      broadcastId
    }, {}, { sort: { createdAt: -1 } })
  }

  /**
   * Update ES index
   */
  async updateEsIndex (broadcastMessage) {
    const body = {
      id: broadcastMessage._id,
      type: 'chat',
      frontId: broadcastMessage.frontId,
      chatId: `B-${broadcastMessage.broadcastId}`,
      broadcastId: broadcastMessage.broadcastId,
      fromProfileId: broadcastMessage.fromProfileId,
      fromManagerProfileId: broadcastMessage.fromManagerProfileId,
      toProfileIds: broadcastMessage.toProfileIds,
      content: {
        text: broadcastMessage.content.text,
        subject: null
      },
      createdAt: broadcastMessage.createdAt,
      updatedAt: broadcastMessage.updatedAt
    }
    await this.updateBroadcastEsIndex(broadcastMessage)
    return es.index({
      index: envPrefix + messagesConstants.globalMessagesIndex,
      id: `B-${broadcastMessage._id}`,
      body: body
    })
  }

  /**
   * Update broadcast ES index
   * @param {*} broadcastMessage
   */
  async updateBroadcastEsIndex (broadcastMessage) {
    const chatId = `B-${broadcastMessage.broadcastId}`
    const lastMessage = await this.lastMessage(broadcastMessage.broadcastId)
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
            toProfileIds: broadcastMessage.toProfileIds
          },
          lang: 'painless'
        },
        query: {
          bool: {
            must: [
              {
                match: {
                  id: chatId
                }
              }
            ]
          }
        }
      }
    })
    log.info('Updated broadcast')
    log.info(result)
    return !!result.updated
  }
}

module.exports = BroadcastmessageController
