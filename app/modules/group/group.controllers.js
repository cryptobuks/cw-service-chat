const { db, ctr, rabbitmq, es, envPrefix, log } = require('@cowellness/cw-micro-service')()
const chatConstants = require('../chat/chat.constants')
/**
 * @class GroupController
 * @classdesc Controller Group
 */
class GroupController {
  constructor () {
    this.Group = db.chat.model('Group')
  }

  /**
   * List all groups
   * @param {*} data
   * @returns groups
   */
  async getGroups ({ _user }) {
    const groups = await this.Group.find({ 'members.profileId': _user.profileId }).lean()

    return Promise.all(groups.map(group => {
      return ctr.groupMessage.lastMessage(group._id)
        .then(lastMessage => {
          group.lastMessage = lastMessage
          return group
        })
    }))
  }

  /**
   * Creates a group
   * @param {Object} data Group model data
   * @returns group model
   */
  async createGroup ({ _user, name, description, filter, base64 }, auth) {
    const isSalesman = await auth.isSalesman()

    if (isSalesman) {
      throw new Error('[SP] is not allowed')
    }
    const group = {
      ownerId: _user.profileId,
      name,
      description,
      avatar: null,
      filter,
      members: []
    }

    if (!filter.profiles || !filter.profiles.length) {
      filter.profiles = []
    }
    if (!filter.profiles.includes(_user.profileId)) {
      filter.profiles.push(_user.profileId)
    }

    if (base64) {
      const imageData = await ctr.message.uploadImage(base64)

      group.avatar = {
        id: imageData._id,
        filename: imageData.filename
      }
    }
    if (filter) {
      const { data: profileIds } = await rabbitmq.sendAndRead('/auth/profile/getProfilesFiltered', filter)

      group.members = profileIds.map(profileId => ({ profileId, status: 'active' }))
    }
    const createdGroup = await this.Group.create(group)
    createdGroup.chatId = `G-${createdGroup._id}`
    return createdGroup.save()
  }

  /**
   * Get one group
   * @param {*} data
   * @returns group data
   */
  getGroup ({ _user, chatId }) {
    return this.Group.findOne({ chatId, 'members.profileId': _user.profileId })
  }

  /**
   * Update a group
   * @param {*} data
   * @returns updated group
   */
  async updateGroup ({ _user, chatId, name, description, filter, base64 }) {
    const group = await this.Group.findOne({
      ownerId: _user.profileId,
      chatId
    })

    if (!group) {
      return null
    }
    if (!filter.profiles || !filter.profiles.length) {
      filter.profiles = []
    }
    if (!filter.profiles.includes(_user.profileId)) {
      filter.profiles.push(_user.profileId)
    }
    group.name = name
    group.filter = filter
    group.description = description
    if (base64) {
      const imageData = await ctr.message.uploadImage(base64)

      group.avatar = {
        id: imageData._id,
        filename: imageData.filename
      }
    }
    if (filter) {
      const { data: profileIds } = await rabbitmq.sendAndRead('/auth/profile/getProfilesFiltered', filter)
      const memberIds = []
      group.members = group.members.map(member => {
        if (!profileIds.includes(member.profileId) && member.profileId !== _user.profileId) {
          member.status = 'archived'
        }
        memberIds.push(member.profileId)
        return member
      })
      profileIds.forEach(profileId => {
        if (!memberIds.includes(profileId)) {
          group.members.push({
            profileId,
            status: 'active'
          })
        }
      })
    }
    return group.save()
  }

  /**
   * Delete a group
   * @param {*} data
   * @returns {Boolean}
   */
  async deleteGroup ({ _user, chatId }) {
    const deleted = await this.Group.deleteOne({
      ownerId: _user.profileId,
      chatId
    })

    return deleted.deletedCount > 0
  }

  /**
   * change member status
   * @param {*} data
   * @returns group
   */
  async changeMemberStatus ({ _user, chatId, profileId, status }) {
    const group = await this.Group.findOne({
      ownerId: _user.profileId,
      chatId
    })

    if (!group) {
      return null
    }
    const member = group.members.find(member => member.profileId === profileId)

    if (!member) {
      return null
    }
    group.members = group.members.map(member => {
      if (member.profileId === profileId && member.profileId !== _user.profileId) {
        member.status = status
      }
      return member
    })
    return group.save()
  }

  /**
   * Update ES index with group data
   * @param group the group doc
   */
  async updateEsIndex (group) {
    const doc = {
      id: group._id,
      type: 'group',
      chatId: group.chatId,
      name: group.name,
      avatar: group.avatar,
      ownerId: group.ownerId,
      filter: group.filter,
      members: group.members,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt
    }

    const indexed = await es.update({
      index: envPrefix + chatConstants.globalChatsIndex,
      id: `G-${group._id}`,
      body: {
        doc
      },
      refresh: true,
      doc_as_upsert: true
    })
    const chat = await ctr.chat.getChat({
      _user: {
        profileId: group.ownerId
      },
      chatId: `G-${group._id}`
    })
    this.pushMessage({
      data: {
        chat
      },
      profileIds: group.members.map(member => member.profileId)
    })
    log.info('Indexed group')
    log.info(indexed)
    return indexed
  }

  /**
   * Push a group to users through ws
   * @param {*} data
   * @returns sent group
   */
  async pushMessage ({ data, profileIds }) {
    const destination = {
      toProfileIds: profileIds,
      msgObj: {
        service: 'chat',
        module: 'group',
        action: 'setChat',
        payload: {
          data
        }
      }
    }

    const { data: sentPush } = await rabbitmq.sendAndRead('/ws/send', destination)

    return sentPush
  }
}

module.exports = GroupController
