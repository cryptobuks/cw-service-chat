const { db, rabbitmq, _, ctr, es, envPrefix, log, redisJson, email: emailHelper, sms: smsHelper } = require('@cowellness/cw-micro-service')()
const sharp = require('sharp')
const md5 = require('md5')
const { nanoid, customAlphabet } = require('nanoid')
const constants = require('./message.constants')
const chatConstants = require('../chat/chat.constants')
/**
 * @class MessagesController
 * @classdesc Controller Messages
 */
class MessagesController {
  constructor () {
    this.Message = db.chat.model('Message')
  }

  /**
   * Creates in a new message in channel chat
   * @param {Object} data toProfileId
   * @returns created message
   */
  async createMessage ({ _user, channel = 'chat', deviceId, toProfileId, chatId, content, frontId, replyToMessageId, broadcastMessageId }) {
    const { profileId, managerId } = _user
    const fromProfileId = profileId
    const fromManagerProfileId = managerId || null

    if (chatId) {
      if (!chatId.startsWith('R-')) {
        return null
      }
      const chat = await ctr.chat.getChat({ _user, chatId })

      toProfileId = chat.profileId
    } else if (toProfileId) {
      const chat = await ctr.chat.getChatByProfile({ userProfileId: _user.profileId, profileId: toProfileId })

      chatId = chat.chatId
    } else {
      return null
    }
    const isMessageAllowed = await this.isMessageAllowed(fromProfileId, toProfileId)
    if (!isMessageAllowed) {
      throw new Error('Account inactive')
    }
    const existingMessage = await this.Message.findOne({ frontId, fromProfileId, toProfileId })

    if (existingMessage) {
      return existingMessage
    }
    if (content.base64) {
      if (content.type === 'image') {
        const imageData = await this.uploadImage(content.base64, content.filename)

        content.imageId = imageData._id
        content.filename = imageData.filename
        content.mimeType = imageData.mimeType
        content.size = imageData.size
      }
      if (content.type === 'audio') {
        const audioData = await this.uploadMedia(content.base64, content.filename)

        content.audioId = audioData._id
        content.filename = audioData.filename
        content.mimeType = audioData.mimeType
        content.size = audioData.size
      }
      if (content.type === 'file') {
        const fileData = await this.uploadMedia(content.base64, content.filename)

        content.fileId = fileData._id
        content.filename = fileData.filename
        content.mimeType = fileData.mimeType
        content.size = fileData.size
      }
    }
    if (content.text) {
      content.text = content.text.trim().substr(0, constants.maxMessageLength)
    }
    if (content.subject) {
      content.subject = content.subject.substr(0, constants.maxMessageLength)
    }
    // const isBusinessProfile = await this.isBusinessProfile(profileId)

    // if (isBusinessProfile) {
    // await this.setPreviousMessagesManaged(profileId, toProfileId, Date.now())
    // }
    const sessionId = await this.getLastSessionId(fromProfileId, toProfileId)

    this.setPreviousMessagesManaged(profileId, toProfileId, Date.now())
    const message = await this.Message.create({
      frontId,
      chatId,
      deviceId,
      sessionId,
      channel,
      fromProfileId,
      fromManagerProfileId,
      broadcastId: null,
      toProfileId,
      replyToMessageId,
      content,
      broadcastMessageId,
      showInDashboard: true
    })
    this.createNotificationReminder(message)
    this.pushMessage({ _user, message })
    return message
  }

  /**
   * Create system message
   * @param {*} data {toProfileId, content}
   * @returns message
   */
  async createSystemMessage ({ toProfileId, content }) {
    const message = await this.Message.create({
      frontId: '1-' + Date.now(),
      chatId: `S-${toProfileId}`,
      fromProfileId: constants.systemChatId,
      fromManagerProfileId: null,
      channel: 'system',
      toProfileId,
      content
    })
    await this.updateEsSytemChatIndex(toProfileId)
    await this.pushMessage({ message })
    return message
  }

  /**
   * Check if profiles can exchange message
   * @param {*} fromProfileId sender
   * @param {*} toProfileId receiver
   */
  async isMessageAllowed (fromProfileId, toProfileId) {
    const profileActive = await ctr.chat.filterActiveProfiles([fromProfileId, toProfileId])

    if (profileActive.length !== 2) {
      return false
    }
    const relationActive = await ctr.chat.filterActiveRelations(fromProfileId, [toProfileId])

    if (!relationActive.length) {
      return false
    }
    return true
  }

  /**
   * update system message in ES index
   * @param {*} profileId
   * @returns
   */
  async updateEsSytemChatIndex (profileId) {
    const lastMessage = await this.lastMessage(constants.systemChatId, profileId)
    const firstMessage = await this.firstMessage(constants.systemChatId, profileId)
    const body = {
      id: profileId,
      type: 'chat',
      firstMessage,
      lastMessage,
      leftProfile: {
        _id: constants.systemChatId,
        displayName: 'System',
        _displayName: 'chat.virtual.system'
      },
      rightProfile: {
        _id: profileId
      },
      createdAt: _.get(lastMessage, 'createdAt', null),
      updatedAt: _.get(lastMessage, 'updatedAt', null)
    }

    return es.index({
      index: envPrefix + chatConstants.globalChatsIndex,
      id: `S-${profileId}`,
      body: body
    })
  }

  /**
   * Get previous message sessionId
   * @param {*} fromProfileId
   * @param {*} toProfileId
   * @returns sessionId if present
   */
  async getLastSessionId (fromProfileId, toProfileId) {
    const message = await this.lastMessage(fromProfileId, toProfileId)

    return message?.sessionId
  }

  /**
   * Creates a notification reminder
   */
  async createNotificationReminder (message) {
    const profile = await ctr.chat.getFriend({ profileId: message.fromProfileId })
    const isBusinessProfile = await this.isBusinessProfile(message.toProfileId)

    if (isBusinessProfile) {
      return null
    }
    await rabbitmq.send('/notifications/new-message', {
      channel: 'chat',
      toProfileId: message.toProfileId,
      fromProfileId: message.fromProfileId,
      fromProfileName: profile.displayName,
      messageId: message._id,
      chatId: message.chatId,
      message: message.content.type === 'text' ? message.content.text : null,
      createdAt: message.createdAt
    })
  }

  /**
   * Archives notification reminder for a profile
   * @param {Object} message {profileId, channel}
   */
  async resetNotificationReminder (profileId) {
    const isBusinessProfile = await this.isBusinessProfile(profileId)

    if (isBusinessProfile) {
      return null
    }
    await rabbitmq.send('/notifications/archive', {
      channel: 'chat',
      profileId
    })
  }

  /**
   * Creates a new message in email channel
   * @param {*} data
   * @returns created message
   */
  async createMailMessage ({ fromProfileId, toProfileId, data }) {
    const chat = await ctr.chat.getChatByProfile({
      userProfileId: fromProfileId,
      profileId: toProfileId
    })
    const chatId = chat.chatId
    const message = await this.Message.create({
      channel: 'email',
      chatId,
      fromProfileId,
      toProfileId,
      content: {
        type: 'email',
        text: data.text,
        html: data.html,
        subject: data.subject,
        attachments: data.attachments,
        messageId: data.messageId,
        from: data.from,
        to: data.to,
        cc: data.cc
      }
    })

    await this.pushMessage({ message })

    return message
  }

  /**
   * Sends a base64 data to file service
   * @param {*} base64
   * @returns created file
   */
  async uploadImage (base64, filename) {
    const name = filename || md5(Date.now())
    const bufferData = await sharp(Buffer.from(base64, 'base64'))
      .resize(800)
      .jpeg({ quality: 80 })
      .toBuffer()
    const { data } = await rabbitmq.sendAndRead('/files/post', {
      filename: name,
      binData: bufferData.toString('base64')
    })

    rabbitmq.send('/files/optimize', {
      _id: data._id
    })
    return data
  }

  /**
   * Sends a base64 media to file service
   * @param {*} base64
   * @returns created file
   */
  async uploadMedia (base64, filename) {
    const name = filename || md5(Date.now())
    const { data } = await rabbitmq.sendAndRead('/files/post', {
      filename: name,
      binData: base64
    })

    return data
  }

  /**
   * Get list of messages
   * @param {*} data
   * @returns messages
   */
  async getMessages ({ _user, chatId, limit = 50 }) {
    const filter = {
      $or: [
        { fromProfileId: _user.profileId, chatId },
        { chatId, toProfileId: _user.profileId }
      ]
    }

    const messages = await this.Message.find(filter).populate('_replyToMessage').sort({ createdAt: -1 }).limit(limit).lean()
    await this.setMessagesDelivered(_user.profileId, messages)
    return messages.map(message => this.truncateMessage(message))
  }

  /**
   * remove unnecessary properties
   * @param {*} message
   * @returns truncated message
   */
  truncateMessage (message) {
    if (message.content.text) {
      const textLength = message.content.text.length

      message.content.text = message.content.text.slice(0, constants.truncateLength)
      if (message.content.text.length !== textLength) {
        message.content.isTruncated = true
      }
    }

    if (message._replyToMessage) {
      message._replyToMessage = this.reduceFieldsMessage(this.truncateMessage(message._replyToMessage))
    }
    message.content.html = null
    if (message.isDeleted) {
      message.content = null
    }
    return message
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
        { chatId, toProfileId: _user.profileId }
      ]
    }
    const toMessage = await this.Message.findOne({ _id: toMessageId })

    if (toMessage) {
      _.set(filter, 'createdAt.$lte', toMessage.createdAt)
    }
    const messages = await this.Message.find(filter).populate('_replyToMessage').sort({ createdAt: -1 }).limit(limit).lean()

    await this.setMessagesDelivered(_user.profileId, messages)
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
        { chatId, toProfileId: _user.profileId }
      ]
    }
    if (fromMessageId) {
      const fromMessage = await this.Message.findOne({ _id: fromMessageId })

      if (fromMessage) {
        _.set(filter, 'createdAt.$gte', fromMessage.createdAt)
      }
    }
    const messages = await this.Message.find(filter).populate('_replyToMessage').sort({ createdAt: 1 }).limit(limit).lean()

    await this.setMessagesDelivered(_user.profileId, messages)
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
   * Get a single message
   * @param {*} data
   * @returns single message object
   */
  async getMessage ({ _user, messageId }) {
    const message = await this.Message.findOne({
      _id: messageId,
      $or: [
        { fromProfileId: _user.profileId },
        { toProfileId: _user.profileId }
      ]
    }).populate('_replyToMessage').lean()

    return this.reduceFieldsMessage(message)
  }

  /**
   * Set all messages as delivered
   * @param {String} profileId
   * @param {Array} messages
   * @returns number of modified messages
   */
  async setMessagesDelivered (profileId, messages) {
    const updates = await this.Message.updateMany({
      toProfileId: profileId,
      _id: {
        $in: messages.map(message => message._id)
      },
      isDelivered: false
    }, {
      $set: {
        isDelivered: true,
        deliveredAt: Date.now()
      }
    })

    return updates.nModified
  }

  /**
   * Set a message to be viewed
   * @param {Object} data {messageId}
   * @returns modified message
   */
  async setMessageView ({ _user, messageId }) {
    const message = await this.Message.findOne({ _id: messageId, toProfileId: _user.profileId })

    if (!message) {
      return null
    }
    if (!message.isViewed) {
      message.isViewed = true
      message.viewedAt = Date.now()
      message.showInDashboard = false
      await message.save()
    }
    await this.setPreviousMessagesViewed(message.toProfileId, message.fromProfileId, message.createdAt)
    if (message.broadcastMessageId) {
      await ctr.broadcastMessage.setMessageView({
        broadcastMessageId: message.broadcastMessageId,
        profileId: _user.profileId
      })
    }
    await this.pushMessage({ _user, message })
    return message
  }

  /**
   * Set a message to be clicked
   * @param {Object} data {messageId}
   * @returns modified message
   */
  async setMessageClick ({ _user, messageId, type, value }) {
    const message = await this.Message.findOne({ _id: messageId, toProfileId: _user.profileId })

    if (!message) {
      return null
    }

    const hasClicked = message.clicks.find(click => {
      if (click.profileId === _user.profileId && click.type === type) {
        if (click.type === 'link' && click.value !== value) {
          return false
        }
        return true
      }
      return false
    })

    if (!hasClicked) {
      message.clicks.push({
        profileId: _user.profileId,
        type,
        value
      })
      await message.save()
    }
    if (message.broadcastMessageId) {
      await ctr.broadcastMessage.setMessageClick({
        broadcastMessageId: message.broadcastMessageId,
        profileId: _user.profileId,
        type,
        value
      })
    }
    await this.pushMessage({ _user, message })
    return message
  }

  /**
   * Add reaction to message
   * @param {Object} data {messageId, reactionId}
   * @returns modified message
   */
  async setMessageReaction ({ _user, messageId, reactionId }) {
    const message = await this.Message.findOne({
      _id: messageId,
      $or: [
        { toProfileId: _user.profileId }
      ]
    })

    if (!message) {
      return null
    }
    const hasReacted = message.reactions.find(reaction => reaction.profileId === _user.profileId && reaction.reactionId === reactionId)

    if (!hasReacted) {
      message.reactions.push({
        profileId: _user.profileId,
        reactionId
      })
      const isBusinessProfile = await this.isBusinessProfile(message.toProfileId)

      if (isBusinessProfile) {
        message.isManaged = true
        message.managedAt = Date.now()
      }
    }
    if (message.broadcastMessageId) {
      await ctr.broadcastMessage.setMessageReaction({
        broadcastMessageId: message.broadcastMessageId,
        profileId: _user.profileId,
        reactionId
      })
    }
    await message.save()
    await this.setPreviousMessagesManaged(message.toProfileId, message.fromProfileId, message.createdAt)
    await this.pushMessage({ _user, message })
    return message
  }

  /**
   * Set all previous messages to be viewed
   * @param {Object} data
   * @returns modified message
   */
  async setPreviousMessagesViewed (toProfileId, fromProfileId, createdAt) {
    const messages = await this.Message.find({
      toProfileId,
      fromProfileId,
      createdAt: {
        $lte: createdAt
      },
      isViewed: false
    })
    const updated = messages.map(message => {
      message.isViewed = true
      message.viewedAt = Date.now()
      return message.save().then(() => {
        this.pushMessage({ message })
      })
    })
    return Promise.all(updated)
  }

  /**
   * Set all previous messages to be managed
   * @param {Object} data
   * @returns modified message
   */
  async setPreviousMessagesManaged (toProfileId, fromProfileId, createdAt) {
    const messages = await this.Message.find({
      toProfileId,
      fromProfileId,
      createdAt: {
        $lte: createdAt
      },
      isManaged: false
    })
    const updated = messages.map(message => {
      message.isManaged = true
      message.showInDashboard = false
      message.managedAt = Date.now()
      return message.save().then(() => {
        this.pushMessage({ message })
      })
    })
    return Promise.all(updated)
  }

  /**
   * Set content for message to null
   * @param {*} data {messageId}
   * @returns empty content message
   */
  async deleteMessage ({ _user, messageId }) {
    const message = await this.Message.findOne({ _id: messageId, fromProfileId: _user.profileId })

    if (!message) {
      return null
    }
    if (!message.isViewed) {
      message.isDeleted = true
      message.deletedAt = Date.now()
      await message.save()
      message.content = null
    }
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
      toProfileIds: [message.toProfileId, message.fromProfileId],
      msgObj: {
        service: 'chat',
        module: 'message',
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
    const deliveredMessages = data.filter(d => d.profileId === message.toProfileId && d.delivered)

    if (deliveredMessages.length > 0 && !message.isDelivered) {
      message.isDelivered = true
      message.deliveredAt = Date.now()
      await message.save()
    }
    return data
  }

  /**
   * Get first message between profiles
   * @param {*} fromProfileId
   * @param {*} toProfileId
   * @returns single message
   */
  firstMessage (fromProfileId, toProfileId) {
    return this.Message.findOne({
      $or: [
        { fromProfileId, toProfileId },
        { toProfileId: fromProfileId, fromProfileId: toProfileId }
      ]
    }, {}, { sort: { createdAt: 1 } })
  }

  /**
   * Get last message between profiles
   * @param {*} fromProfileId
   * @param {*} toProfileId
   * @returns single message
   */
  lastMessage (fromProfileId, toProfileId) {
    return this.Message.findOne({
      $or: [
        { fromProfileId, toProfileId },
        { toProfileId: fromProfileId, fromProfileId: toProfileId }
      ]
    }, {}, { sort: { createdAt: -1 } })
  }

  /**
   * Get unread count
   * @param {*} profileId
   * @param {*} chatProfileId
   * @returns number of messages unread
   */
  async unreadCount (profileId, chatProfileId) {
    const result = await es.count({
      index: envPrefix + constants.globalMessagesIndex,
      body: {
        query: {
          bool: {
            must: [
              {
                match: {
                  toProfileId: profileId
                }
              },
              {
                match: {
                  fromProfileId: chatProfileId
                }
              },
              {
                match: {
                  isViewed: false
                }
              }
            ]
          }
        }
      }
    })
    return result.count
  }

  /**
   * Get unmanaged messages count
   * @param {*} profileId
   * @param {*} chatProfileId
   * @returns number of unmanaged messages
   */
  async unManagedCount (profileId, chatProfileId) {
    const result = await es.count({
      index: envPrefix + constants.globalMessagesIndex,
      body: {
        query: {
          bool: {
            must: [
              {
                match: {
                  toProfileId: profileId
                }
              },
              {
                match: {
                  fromProfileId: chatProfileId
                }
              },
              {
                match: {
                  isManaged: false
                }
              }
            ]
          }
        }
      }
    })
    return result.count
  }

  /**
   * Search for messages
   * @param {*} param0 limit, query
   */
  async searchMessages ({ _user, limit = 50, query, chatId }) {
    const must = [
      {
        bool: {
          should: [
            {
              match: {
                fromProfileId: _user.profileId
              }
            },
            {
              match: {
                toProfileId: _user.profileId
              }
            },
            {
              match: {
                toProfileIds: _user.profileId
              }
            }
          ]
        }
      },
      {
        query_string: {
          fields: ['content.text', 'content.subject'],
          query: '*' + query + '*'
        }
      }
    ]
    if (chatId) {
      must.push({
        match: {
          'chatId.keyword': chatId
        }
      })
    }
    const result = await es.search({
      index: envPrefix + constants.globalMessagesIndex,
      body: {
        sort: [
          { createdAt: { order: 'desc' } }
        ],
        track_scores: true,
        size: limit,
        query: {
          bool: {
            must
          }
        },
        highlight: {
          fields: {
            'content.*': { fragment_size: 60, number_of_fragments: 1 }
          }
        }
      }
    })

    return _.get(result, 'hits.hits', []).map(item => ({
      _id: item._source.id,
      ...item._source,
      highlight: item.highlight,
      score: item._score
    }))
  }

  /**
   * Returns all system reactions
   */
  getReactionsList () {
    return constants.reactions
  }

  /**
   * Delete a message reaction
   * @param {*} data
   * @returns single message
   */
  async deleteMessageReaction ({ _user, messageId, reactionId }) {
    const message = await this.Message.findOne({
      _id: messageId,
      $or: [
        { toProfileId: _user.profileId }
      ]
    })

    if (!message) {
      return null
    }

    const beforeLen = message.reactions.length
    message.reactions = message.reactions.filter(reaction => !(reaction.profileId === _user.profileId && reaction.reactionId === reactionId))

    if (beforeLen !== message.reactions.length) {
      await message.save()
      this.pushMessage({ _user, message })
    }
    return message
  }

  /**
   * Check if business profile
   * @param {*} profileId
   * @returns isBusiness
   */
  async isBusinessProfile (profileId) {
    const { data } = await rabbitmq.sendAndRead('/auth/ws', {
      service: 'auth',
      module: 'profile',
      action: 'detail',
      payload: {
        _user: {
          profileId
        }
      }
    })

    return _.get(data, 'data.isBusiness')
  }

  /**
   * Chat plugin: Get a single Profile or create
   * @param {Object} data firstname, email, phone, dob
   * @returns profile data
   */
  async getProfile ({ firstname, email, phone, dob }) {
    let profile = null

    if (email) {
      profile = await this.getProfileByFilter({
        'person.emails.email': email
      })
    } else if (phone) {
      profile = await this.getProfileByFilter({
        $or: [
          {
            'person.mobilePhones.countryCode': phone.countryCode,
            'person.mobilePhones.prefixNumber': phone.prefixNumber,
            'person.mobilePhones.phoneNumber': phone.phoneNumber
          }
        ]
      })
    }
    if (!profile) {
      await this.createProfile({ firstname, email, phone, dob })
      return this.getProfile({ firstname, email, phone, dob })
    }
    return profile
  }

  /**
   * Chat plugin: create a profile by email or phone
   * @param {*} data
   * @returns profile
   */
  createProfile ({ firstname, email, phone }) {
    if (email) {
      return this.createTemporaryProfileByEmail(email, firstname)
    } else if (phone) {
      return this.createTemporaryProfileByPhone(phone, firstname)
    }
    return null
  }

  /**
   * Find a gym profile
   * @param {*} id id of gym
   * @returns profile
   */
  async findGymById (id) {
    const { data: profile } = await rabbitmq.sendAndRead('/auth/profile/get', {
      _id: id
      // typeCode: ['CH', 'CW', 'CU', 'GH', 'GY', 'GU', 'SI']
    })

    return _.first(profile)
  }

  /**
   * Get a profile by filter from auth service
   * @param {*} filter
   * @returns profile
   */
  async getProfileByFilter (filter) {
    const { data: profile } = await rabbitmq.sendAndRead('/auth/profile/get', filter)

    return _.first(profile)
  }

  /**
   * Creates a temporary profile by email
   * @param {*} email
   * @param {*} dob
   * @param {*} firstname
   * @returns profile
   */
  async createTemporaryProfileByEmail (email, firstname) {
    const { data: profile } = await rabbitmq.sendAndRead('/auth/profile/create', {
      'person.firstname': firstname,
      'person.emails': [{
        email
      }],
      typeCode: 'IN'
    })

    return profile
  }

  /**
   * Creates a temporary profile by phone
   * @param {*} phone
   * @param {*} dob
   * @param {*} firstname
   * @returns profile
   */
  async createTemporaryProfileByPhone (phone, firstname) {
    const { data: profile } = await rabbitmq.sendAndRead('/auth/profile/create', {
      'person.firstname': firstname,
      'person.mobilePhones': [{
        countryCode: phone.countryCode,
        prefixNumber: phone.prefixNumber,
        phoneNumber: phone.phoneNumber
      }],
      typeCode: 'IN'
    })

    return profile
  }

  /**
   * Finds or creates a relation
   * @param {*} data
   * @returns relation object
   */
  async findOrCreateRelation ({ leftProfileId, rightProfileId }) {
    const { data: relations } = await rabbitmq.sendAndRead('/auth/relation/get', {
      profileId: rightProfileId,
      managerId: ''
    })
    const isRelated = relations.find(relation => relation.profile._id === leftProfileId)

    if (!isRelated) {
      const { data: relation } = await rabbitmq.sendAndRead('/auth/relation/create', {
        leftProfileId,
        rightProfileId
      })

      return relation
    }
    return isRelated
  }

  /**
   * Chat plugin: Get list of messages
   * @param {*} data
   * @returns messages list
   */
  async getMessagesForPlugin ({ sessionId, userId, gymId, fromMessageId, limit = 30 }) {
    const filter = {
      sessionId,
      $or: [
        { fromProfileId: userId, toProfileId: gymId },
        { fromProfileId: gymId, toProfileId: userId }
      ]
    }
    if (fromMessageId) {
      const offsetMessage = await this.Message.findOne({ _id: fromMessageId }, 'createdAt')

      if (offsetMessage) {
        filter.createdAt = {
          $gt: offsetMessage.createdAt
        }
      }
    }
    const date = new Date()

    let messages = await this.Message.find(filter).sort({ createdAt: -1 }).limit(limit).lean()
    if (messages.length) {
      messages = messages.map(msg => this.reduceFieldsMessage(msg)).map(msg => {
        if (msg.fromManagerProfileId) {
          return ctr.chat.getFriend({ profileId: msg.fromManagerProfileId })
            .then(manager => {
              msg.managerName = manager.displayName
              return msg
            })
        }
        return msg
      })

      await this.setPreviousMessagesViewed(userId, gymId, date)
    }
    return Promise.all(messages)
  }

  /**
   * Chat plugin: send a message through plugin
   * @param {*} data
   * @returns created message
   */
  async sendMessageForPlugin ({ frontId, sessionId, userId, gymId, text }) {
    const message = await this.createMessage({
      _user: {
        profileId: userId
      },
      channel: 'plugin',
      toProfileId: gymId,
      content: {
        type: 'text',
        text: text.replace(/(<([^>]+)>)/gi, '')
      },
      frontId
    })

    return message
  }

  /**
   * Authenticate through login token
   * @param {*} token
   * @returns profile id
   */
  async chatPluginLogin (token) {
    const { data } = await rabbitmq.sendAndRead('/auth/verify/token', {
      token
    })

    if (!data) {
      return null
    }
    return data.profileId
  }

  /**
   * Creates a session token for chat plugin
   * @param {*} data data to store in the token
   * @returns token key
   */
  async createChatPluginKey (data) {
    const key = nanoid()
    await redisJson.set(key, data, { expire: constants.chatPluginSessionExpiryInSeconds })

    return key
  }

  /**
   * Get token data
   * @param {*} key session token
   * @returns token data
   */
  async checkChatPluginKey (key) {
    const session = await redisJson.get(key)
    if (session) {
      await redisJson.set(key, session, { expire: constants.chatPluginSessionExpiryInSeconds })
    }
    return session
  }

  /**
   * Removes the token from redis
   * @param {*} key session token
   * @returns boolean
   */
  async removeChatPluginKey (key) {
    await redisJson.del(key)
    return true
  }

  /**
   * Gym sends default message on first init
   * @param {*} data
   * @returns created message
   */
  async chatPluginFirstMessage ({ sessionId, profile, gymId, relation }) {
    const filter = {
      $or: [
        { fromProfileId: profile._id, toProfileId: gymId },
        { fromProfileId: gymId, toProfileId: profile._id }
      ],
      sessionId
    }
    const hasFirstMessage = await this.Message.findOne(filter)

    if (hasFirstMessage) {
      return null
    }
    const { data: messageText } = await rabbitmq.sendAndRead('/settings/messages/get', {
      key: 'chat.chat-plugin.first-message',
      type: 'chat',
      data: {
        name: profile.displayName || ''
      }
    })
    const message = await this.Message.create({
      channel: 'plugin',
      sessionId,
      chatId: `R-${relation._id}`,
      fromProfileId: gymId,
      toProfileId: profile._id,
      content: {
        type: 'text',
        text: messageText
      }
    })

    this.pushMessage({ message })
    return message
  }

  /**
   * Reduce message properties
   * @param {*} message
   * @returns reduced message
   */
  reduceFieldsMessage (message) {
    return _.pick(message, [
      '_id',
      'frontId',
      'chatId',
      'channel',
      'fromProfileId',
      'fromManagerProfileId',
      'toProfileId',
      'showInDashboard',
      'replyToMessageId',
      '_replyToMessage',
      'content',
      'clicks',
      'actions',
      'views',
      'reactions',
      'isViewed',
      'isForwarded',
      'isDeleted',
      'isManaged',
      'isDelivered',
      'createdAt',
      'updatedAt'
    ])
  }

  /**
   * Get attachment
   * @param {*} data messageId, attachmentId
   * @returns attachment data
   */
  async getAttachment ({ messageId, attachmentId }) {
    const message = await this.Message.findOne({ _id: messageId })

    if (!message) {
      return null
    }
    const emailMessageId = message.content.messageId
    const attachment = _.get(message, 'content.attachments', []).find(item => item.attachmentId === attachmentId)

    if (!emailMessageId || !attachment) {
      return null
    }
    const { data } = await rabbitmq.sendAndRead('/mail-in-chat/attachment/get', {
      messageId: emailMessageId,
      attachment
    })

    return data
  }

  /**
   * Book a shift
   * @param {*} data
   * @returns queue count
   */
  async bookShift ({ frontId, profileId, gymId, deviceId }) {
    log.debug(`bookShift - frontId: ${frontId}, profileId: ${profileId}, gymId: ${gymId}, deviceId: ${deviceId}`)
    let existing = true
    let bookingShift = await this.Message.findOne({
      channel: 'book',
      fromProfileId: profileId,
      toProfileId: gymId,
      isManaged: false
    })
    if (!bookingShift) {
      existing = false
      const countUnmanaged = await this.Message.countDocuments({
        channel: 'book',
        toProfileId: gymId,
        deviceId,
        isManaged: false,
        createdAt: {
          $lt: Date.now()
        }
      })
      const { data: messageText } = await rabbitmq.sendAndRead('/settings/messages/get', {
        key: 'm1.bookshift.success',
        type: 'chat',
        data: {
          count: countUnmanaged
        }
      })
      const { data: autoReplyText } = await rabbitmq.sendAndRead('/settings/messages/get', {
        key: 'm1.bookshift.autoreply',
        type: 'chat',
        data: {}
      })
      bookingShift = await this.createMessage({
        _user: {
          profileId
        },
        channel: 'book',
        deviceId,
        toProfileId: gymId,
        content: {
          type: 'action',
          text: messageText,
          actions: [
            {
              label: 'chat.action.no_show',
              showTo: ['to'],
              frontend: {
                function: 'autoreply',
                params: {
                  defaultText: autoReplyText
                }
              }
            }
          ]
        },
        frontId
      })
    }
    const bookingTime = bookingShift.createdAt
    const countUnmanaged = await this.Message.countDocuments({
      channel: 'book',
      toProfileId: gymId,
      deviceId,
      isManaged: false,
      createdAt: {
        $lt: bookingTime
      }
    })
    log.debug(`bookShift - count: ${countUnmanaged}, existing: ${existing}, bookingTime: ${bookingTime}`)
    return {
      count: countUnmanaged,
      existing
    }
  }

  /**
   * remove booking
   * @param {*} param0
   * @returns bookshift message
   */
  async unbook ({ profileId, gymId, deviceId }) {
    log.debug(`unbook - profileId: ${profileId}, gymId: ${gymId}, deviceId: ${deviceId}`)
    const bookingShift = await this.Message.findOne({
      channel: 'book',
      fromProfileId: profileId,
      toProfileId: gymId,
      isManaged: false
    })

    if (!bookingShift) {
      return null
    }
    bookingShift.isManaged = true
    bookingShift.managedAt = Date.now()
    bookingShift.isViewed = true
    bookingShift.viewedAt = Date.now()
    return bookingShift.save()
  }

  /**
   * Create a message in ask channel
   * @param {*} data
   * @returns created message
   */
  async askInfo ({ frontId, profileId, gymId, deviceId, text }) {
    log.debug(`askInfo - frontId: ${frontId}, profileId: ${profileId}, gymId: ${gymId}, deviceId: ${deviceId}`)
    let existing = true
    let message = await this.Message.findOne({
      channel: 'ask',
      fromProfileId: profileId,
      toProfileId: gymId,
      isManaged: false
    })
    if (!message) {
      existing = false
      message = await this.createMessage({
        _user: {
          profileId
        },
        frontId,
        channel: 'ask',
        toProfileId: gymId,
        deviceId,
        content: {
          type: 'text',
          text
        }
      })
    }

    const countUnmanaged = await this.Message.countDocuments({
      channel: 'book',
      toProfileId: gymId,
      deviceId,
      isManaged: false,
      createdAt: {
        $lt: message.createdAt
      }
    })
    log.debug(`askInfo - count: ${countUnmanaged}, createdAt: ${message.createdAt}`)
    return {
      count: countUnmanaged,
      existing
    }
  }

  /**
   * Update messages ES index
   * @param message
   */
  async updateEsIndex (message) {
    const body = {
      id: message._id,
      type: 'chat',
      frontId: message.frontId,
      chatId: message.chatId,
      channel: message.channel,
      fromProfileId: message.fromProfileId,
      fromManagerProfileId: message.fromManagerProfileId,
      toProfileId: message.toProfileId,
      content: {
        text: message.content.text,
        subject: message.content.subject
      },
      isViewed: message.isViewed,
      isManaged: message.isManaged,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt
    }
    await this.updateLastMessageEsIndex(message)
    return es.index({
      index: envPrefix + constants.globalMessagesIndex,
      id: `M-${message._id}`,
      body: body
    })
  }

  /**
   * Update relation ES index
   * @param {*} message
   */
  async updateLastMessageEsIndex (message) {
    const result = await es.updateByQuery({
      index: envPrefix + chatConstants.globalChatsIndex,
      body: {
        script: {
          source: `
            if (!ctx._source.containsKey('firstMessage') || ctx._source.firstMessage == null) ctx._source.firstMessage = params.lastMessage;
            ctx._source.lastMessage = params.lastMessage;
            ctx._source.updatedAt = params.lastMessage.createdAt;
          `,
          params: {
            lastMessage: message
          },
          lang: 'painless'
        },
        conflicts: 'proceed',
        query: {
          bool: {
            must: [
              {
                bool: {
                  should: [
                    {
                      bool: {
                        must: [
                          {
                            match: {
                              'leftProfile._id': message.fromProfileId
                            }
                          },
                          {
                            match: {
                              'rightProfile._id': message.toProfileId
                            }
                          }
                        ]
                      }
                    },
                    {
                      bool: {
                        must: [
                          {
                            match: {
                              'rightProfile._id': message.fromProfileId
                            }
                          },
                          {
                            match: {
                              'leftProfile._id': message.toProfileId
                            }
                          }
                        ]
                      }
                    }
                  ]
                }
              }
            ]
          }
        }
      }
    })
    return !!result.updated
  }

  /**
   * sets the showInDashboard flag for a message
   * @param {messageId}
   */
  async hideInDashboard ({ _user, messageId }) {
    const message = await this.Message.findOne({
      _id: messageId,
      $or: [
        { toProfileId: _user.profileId }
      ]
    })

    if (!message) {
      return null
    }
    message.showInDashboard = false
    await this.pushMessage({ _user, message })
    return message.save()
  }

  /**
   * create a cron for auto message in chatplugin
   * @param {*} param0
   * @returns
   */
  async chatPluginAutoMessageCron ({ profile, gymId, userId, sessionId }) {
    const email = _.get(profile, 'person.emails[0].email')
    const phone = [_.get(profile, 'person.mobilePhones[0].prefixNumber'), _.get(profile, 'person.mobilePhones[0].phoneNumber')].join('')
    const contact = email || phone
    const { data: messageText } = await rabbitmq.sendAndRead('/settings/messages/get', {
      key: 'm2.chatplugin.waiting',
      type: 'chat',
      data: {
        contact
      }
    })

    const { data: replyMessage } = await rabbitmq.sendAndRead('/settings/messages/get', {
      key: 'm2.chatplugin.request-received-waiting',
      type: 'chat',
      data: {}
    })

    setTimeout(async () => {
      const messages = await this.getMessagesForPlugin({
        sessionId,
        userId,
        gymId
      })
      const gymMessages = messages.filter(message => message.fromProfileId === gymId)
      // check if message was sent by gym
      if (gymMessages.length < 2) {
        log.info('Chat plugin: creating auto message 1')
        this.createMessage({
          _user: {
            profileId: gymId
          },
          frontId: 'chatplugin-' + Date.now(),
          channel: 'plugin',
          sessionId,
          toProfileId: userId,
          content: {
            type: 'text',
            text: replyMessage
          }
        })
      }
    }, 4000)

    return rabbitmq.send('/cron/append', {
      name: `chatplugin:automessage:check:${userId}`,
      type: 'schedule',
      update: false,
      date: Date.now() + (5 * 60 * 1000),
      commands: [{
        type: 'rabbitmq',
        queue: '/chat/message/responded/check',
        msg: {
          _user: {
            profileId: gymId
          },
          frontId: 'chatplugin-' + Date.now(),
          channel: 'plugin',
          sessionId,
          toProfileId: userId,
          content: {
            type: 'text',
            text: messageText
          }
        }
      }]
    })
  }

  /**
   * used by cron to create auto message
   * @param {*} data
   */
  async chatPluginAutoMessageCheck (data) {
    log.info('Chat plugin: auto message check')
    const messages = await this.getMessagesForPlugin({
      sessionId: data.sessionId,
      userId: data.toProfileId,
      gymId: data._user.profileId
    })
    const gymMessages = messages.filter(message => message.fromProfileId === data._user.profileId)
    // check if message was sent by gym
    if (gymMessages.length < 3) {
      log.info('Chat plugin: creating auto message 2')
      this.createMessage(data)
    }
  }

  /**
   * Generate and Send a pin via email or mobile phone
   * @param {*} profile
   * @returns {Object}
   */
  async sendPin (gym, profile) {
    const sixDigit = customAlphabet('1234567890', 6)
    const code = sixDigit()
    rabbitmq.send('/auth/profile/pin/set', {
      profileId: profile._id,
      pin: code
    })
    // const verifiedEmail = _.get(profile, 'person.emails', []).find(e => e.verification === 'checked')
    // const mobilePhone = _.get(profile, 'person.mobilePhones', []).find(e => e.verification === 'checked')
    const verifiedEmail = _.first(_.get(profile, 'person.emails', []))
    const mobilePhone = _.first(_.get(profile, 'person.mobilePhones', []))
    const params = {
      name: profile.displayName,
      businessName: gym.displayName,
      code
    }

    if (verifiedEmail) {
      log.info('sending email to %s, params: %j', verifiedEmail.email, params)
      emailHelper.sendEmail([verifiedEmail.email], undefined, 'chat.chat-plugin.email.validation-pin', profile.settings.language, params)
      return {
        type: 'email',
        sent: true
      }
    } else if (mobilePhone) {
      const phone = _.get(mobilePhone, 'prefixNumber') + _.get(mobilePhone, 'phoneNumber')
      log.info('sending sms to %s, params: %j', phone, params)
      smsHelper.sendWithTemplate('chat.chat-plugin.sms.validation-pin', profile.settings.language, [phone], params)
      return {
        type: 'sms',
        sent: true
      }
    }
    return {
      sent: false
    }
  }

  /**
   * check pin validity
   */
  async validatePin (profile, pin) {
    const { data } = await rabbitmq.sendAndRead('/auth/profile/pin/get', {
      profileId: profile._id
    })

    return data && data === pin
  }
}

module.exports = MessagesController
