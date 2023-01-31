const { db, rabbitmq, ctr, es, envPrefix } = require('@cowellness/cw-micro-service')()

const constants = require('./broadcast.constants')
const chatConstants = require('../chat/chat.constants')
/**
 * @class BroadcastsController
 * @classdesc Controller Broadcasts
 */
class BroadcastsController {
  constructor () {
    this.Broadcast = db.chat.model('Broadcast')
  }

  /**
   * get a list of broadcasts
   * @param {*} param0
   * @returns broadcasts
   */
  getBroadcasts ({ _user }) {
    return this.Broadcast.find({
      $or: [
        {
          ownerId: _user.profileId
        },
        {
          managedBy: _user.profileId
        }
      ]
    })
  }

  /**
   * Creates a broadcast
   * @param {Object} data Broadcast model data'
   * @returns broadcast model
   */
  async createBroadcast ({ _user, name, description, filter, base64, managedBy }, auth) {
    const broadcast = {
      ownerId: _user.profileId,
      managedBy,
      name,
      description,
      filter,
      members: [],
      avatar: null
    }
    const isSalesman = await auth.isSalesman()

    if (isSalesman) {
      broadcast.managedBy = _user.profileId
    }

    if (base64) {
      const imageData = await ctr.message.uploadImage(base64)

      broadcast.avatar = {
        id: imageData._id,
        filename: imageData.filename
      }
    }
    if (filter) {
      const { data: profileIds } = await rabbitmq.sendAndRead('/auth/profile/getProfilesFiltered', filter)

      broadcast.members = profileIds.map(profileId => ({ profileId, status: 'active' }))
    }
    const createdBroadcast = await this.Broadcast.create(broadcast)

    createdBroadcast.chatId = `B-${createdBroadcast._id}`
    return createdBroadcast.save()
  }

  /**
   * get single broadcast by chatId
   * @param {*} data {chatId}
   * @returns broadcast
   */
  getBroadcast ({ _user, chatId }) {
    return this.Broadcast.findOne({ ownerId: _user.profileId, chatId })
  }

  /**
   * update a broadcast
   * @param {*} data
   * @param {*} auth
   * @returns broadcast
   */
  async updateBroadcast ({ _user, chatId, description, name, filter, base64, managedBy }, auth) {
    const broadcast = await this.Broadcast.findOne({
      ownerId: _user.profileId,
      chatId
    })

    if (!broadcast) {
      throw new Error('Broadcast not found')
    }
    broadcast.name = name
    broadcast.filter = filter
    broadcast.description = description
    broadcast.managedBy = managedBy
    const isSalesman = await auth.isSalesman()

    if (isSalesman) {
      broadcast.managedBy = _user.profileId
    }
    if (base64) {
      const imageData = await ctr.message.uploadImage(base64)

      broadcast.avatar = {
        id: imageData._id,
        filename: imageData.filename
      }
    }
    if (filter) {
      const { data: profileIds } = await rabbitmq.sendAndRead('/auth/profile/getProfilesFiltered', filter)
      const memberIds = broadcast.members.map(member => member.profileId)

      broadcast.members = profileIds.map(profileId => {
        if (!memberIds.includes(profileId)) {
          return {
            profileId,
            status: 'active'
          }
        }
        return broadcast.members.find(member => member.profileId === profileId)
      })
    }
    return broadcast.save()
  }

  /**
   * delete a broadcast
   * @param {*} data {chatId}
   * @returns boolean
   */
  async deleteBroadcast ({ _user, chatId }) {
    const deleted = await this.Broadcast.deleteOne({
      ownerId: _user.profileId,
      chatId
    })

    return deleted.deletedCount > 0
  }

  /**
   * get filters for broadcast by query
   * @param {*} data {query}
   * @returns filter object
   */
  async filterTarget ({ _user, query }) {
    const queryRegex = new RegExp(query, 'gi')
    const { profileId, managerId } = _user
    const filter = {
      roles: constants.roles.filter(role => queryRegex.test(role.name)),
      courses: [],
      interests: [],
      profiles: []
    }
    const chats = await rabbitmq.sendAndRead('/auth/relation/get', { profileId, managerId })

    if (chats?.data) {
      filter.profiles = chats.data.map(relation => ({
        _id: relation.profile._id,
        firstname: relation.profile.person.firstname,
        lastname: relation.profile.person.lastname
      })).filter(profile => queryRegex.test(profile.firstname) || queryRegex.test(profile.lastname))
    }
    const interestsList = await rabbitmq.sendAndRead('/settings/sportInterest/get')

    if (interestsList?.data) {
      filter.interests = interestsList.data.filter(interest => queryRegex.test(interest.name))
    }

    return filter
  }

  /**
   * Update ES index with broadcast data
   * @param group the broadcast doc
   */
  async updateEsIndex (broadcast) {
    const profileIds = broadcast.members.map(member => member.profileId)
    const doc = {
      id: broadcast._id,
      type: 'broadcast',
      name: broadcast.name,
      chatId: broadcast.chatId,
      avatar: broadcast.avatar,
      ownerId: broadcast.ownerId,
      createdAt: broadcast.createdAt,
      updatedAt: broadcast.updatedAt,
      filter: broadcast.filter,
      profiles: profileIds,
      members: broadcast.members
    }

    const indexed = await es.update({
      index: envPrefix + chatConstants.globalChatsIndex,
      id: `B-${broadcast._id}`,
      body: {
        doc
      },
      refresh: true,
      doc_as_upsert: true
    })
    const chat = await ctr.chat.getChat({
      _user: {
        profileId: broadcast.ownerId
      },
      chatId: `B-${broadcast._id}`
    })

    this.pushMessage({
      data: {
        chat
      },
      profileIds
    })

    return indexed
  }

  /**
   * Push a chat to users through ws
   * @param {*} data
   * @returns sent chat
   */
  async pushMessage ({ data, profileIds }) {
    const destination = {
      toProfileIds: profileIds,
      msgObj: {
        service: 'chat',
        module: 'broadcast',
        action: 'setChat',
        payload: {
          data
        }
      }
    }

    const { data: sentPush } = await rabbitmq.sendAndRead('/ws/send', destination)

    return sentPush
  }

  /**
   * change a member status
   * @param {*} data
   * @returns broadcast
   */
  async changeMemberStatus ({ _user, chatId, profileId, status }) {
    const broadcast = await this.Broadcast.findOne({
      ownerId: _user.profileId,
      chatId
    })

    if (!broadcast) {
      return null
    }
    const member = broadcast.members.find(member => member.profileId === profileId)

    if (!member) {
      return null
    }
    broadcast.members = broadcast.members.map(member => {
      if (member.profileId === profileId && member.profileId !== _user.profileId) {
        member.status = status
      }
      return member
    })
    return broadcast.save()
  }
}

module.exports = BroadcastsController
