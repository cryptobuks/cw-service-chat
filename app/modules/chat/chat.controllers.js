const { rabbitmq, ctr, _, log, es, envPrefix } = require('@cowellness/cw-micro-service')()
const constants = require('./chat.constants')
/**
 * @class ChatController
 * @classdesc Controller Chat
 */
class ChatController {
  /**
   * get chat list
   * @param {*} data {limit, filter}
   * @returns chats
   */
  async getChats ({ _user, limit = 100, filter = [] }) {
    const must = [
      {
        bool: {
          should: [
            {
              match: {
                'leftProfile._id': _user.profileId
              }
            },
            {
              match: {
                'rightProfile._id': _user.profileId
              }
            },
            {
              match: {
                toProfileIds: _user.profileId
              }
            },
            {
              match: {
                ownerId: _user.profileId
              }
            }
          ]
        }
      }
    ]
    if (filter.length) {
      must.push(...filter)
    }
    const result = await es.search({
      index: envPrefix + constants.globalChatsIndex,
      body: {
        sort: [
          { updatedAt: { order: 'desc' } }
        ],
        size: limit,
        query: {
          bool: {
            must
          }
        },
        highlight: {
          fields: {
            'leftProfile.displayName': { fragment_size: 60, number_of_fragments: 1 },
            'rightProfile.displayName': { fragment_size: 60, number_of_fragments: 1 },
            name: { fragment_size: 60, number_of_fragments: 1 }
          }
        }
      }
    })
    const chats = _.get(result, 'hits.hits', [])

    const profileIds = chats.filter(item => item._id.startsWith('R-')).map(item => {
      return item._source.rightProfile._id !== _user.profileId ? item._source.rightProfile._id : item._source.leftProfile._id
    })

    const profileStatuses = await this.getMultiProfileStatus(profileIds)
      .then(statuses => {
        return statuses.filter(s => !!s).reduce((result, item) => {
          return {
            ...result,
            [item.profileId]: item
          }
        }, {})
      })

    return Promise.all(chats.map(item => {
      const chat = item._source
      const result = {}
      const promises = []
      if (chat.type === 'chat') {
        const chatProfile = chat.rightProfile._id !== _user.profileId ? chat.rightProfile : chat.leftProfile

        result.type = chat.type
        result.chatId = item._id
        result._id = chat.id
        result.avatar = chatProfile.avatar
        result.profileId = chatProfile._id
        result.displayName = chatProfile.displayName
        result._displayName = chatProfile._displayName
        result.typeCode = chatProfile.typeCode
        result.firstMessage = chat.firstMessage
        result.lastMessage = chat.lastMessage
        result.createdAt = chat.createdAt
        result.updatedAt = chat.updatedAt
        result.status = chatProfile.status
        result.relationStatus = chat.status
        result.active = false
        result.highlight = item.highlight
        result.score = item._score
        result.active = profileStatuses[chatProfile._id.toString()] || false
        promises.push(ctr.message.unreadCount(_user.profileId, chatProfile._id))
        promises.push(ctr.message.unManagedCount(_user.profileId, chatProfile._id))
      } else
      if (chat.type === 'group') {
        result.type = chat.type
        result.chatId = item._id
        result._id = chat.id
        result.avatar = chat.avatar
        result.profileId = chat.ownerId
        result.displayName = chat.name
        result.firstMessage = chat.firstMessage
        result.lastMessage = chat.lastMessage
        result.members = chat.members
        result.filter = chat.filter
        result.createdAt = chat.createdAt
        result.updatedAt = chat.updatedAt
        result.highlight = item.highlight
        result.score = item._score
      } else
      if (chat.type === 'broadcast') {
        result.type = chat.type
        result.chatId = item._id
        result._id = chat.id
        result.avatar = chat.avatar
        result.profileId = chat.ownerId
        result.displayName = chat.name
        result.firstMessage = chat.firstMessage
        result.lastMessage = chat.lastMessage
        result.profiles = chat.profiles
        result.members = chat.members
        result.filter = chat.filter
        result.createdAt = chat.createdAt
        result.updatedAt = chat.updatedAt
        result.highlight = item.highlight
        result.score = item._score
      }
      return Promise.all(promises)
        .then(meta => {
          const [unreadCount, unManagedCount] = meta

          result.unreadCount = unreadCount
          result.unManagedCount = unManagedCount
          return result
        })
    }))
  }

  /**
   * get single chat by chatId
   * @param {*} data {chatId}
   * @returns chat
   */
  async getChat ({ _user, chatId }) {
    const filter = [{
      match: {
        id: chatId
      }
    }]
    const chats = await this.getChats({ _user, filter })

    return _.first(chats)
  }

  /**
   * get chat by relation
   * @param {*} data {userProfileId, profileId}
   * @returns chat
   */
  async getChatByProfile ({ userProfileId, profileId }) {
    const result = await es.search({
      index: envPrefix + constants.globalChatsIndex,
      body: {
        size: 1,
        query: {
          bool: {
            should: [
              {
                bool: {
                  must: [
                    {
                      match: {
                        'leftProfile._id': userProfileId
                      }
                    },
                    {
                      match: {
                        'rightProfile._id': profileId
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
                        'leftProfile._id': profileId
                      }
                    },
                    {
                      match: {
                        'rightProfile._id': userProfileId
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
    const chats = _.get(result, 'hits.hits')
    const chat = _.first(chats)

    return {
      chatId: chat._id,
      ...chat._source
    }
  }

  /**
   * search chat by query
   * @param {*} data {query}
   * @returns chats
   */
  async searchChats ({ _user, query }) {
    const must = [
      {
        bool: {
          should: [
            {
              bool: {
                must: [
                  {
                    query_string: {
                      fields: [
                        'rightProfile.displayName',
                        'rightProfile.person.firstname',
                        'rightProfile.person.lastname',
                        'rightProfile.person.emails.email',
                        'rightProfile.person.phones.phoneNumber',
                        'rightProfile.person.mobilePhones.phoneNumber',
                        'rightProfile.ids.value',
                        'rightProfile.company.name',
                        'rightProfile.company.brand'
                      ],
                      query,
                      type: 'bool_prefix',
                      default_operator: 'AND'
                    }
                  },
                  {
                    match: {
                      'leftProfile._id': _user.profileId
                    }
                  }
                ]
              }
            },
            {
              bool: {
                must: [
                  {
                    query_string: {
                      fields: [
                        'leftProfile.displayName',
                        'leftProfile.person.firstname',
                        'leftProfile.person.lastname',
                        'leftProfile.person.emails.email',
                        'leftProfile.person.phones.phoneNumber',
                        'leftProfile.person.mobilePhones.phoneNumber',
                        'leftProfile.ids.value',
                        'leftProfile.company.name',
                        'leftProfile.company.brand'
                      ],
                      query,
                      type: 'bool_prefix',
                      default_operator: 'AND'
                    }
                  },
                  {
                    match: {
                      'rightProfile._id': _user.profileId
                    }
                  }
                ]
              }
            },
            {
              bool: {
                must: [
                  {
                    query_string: {
                      fields: [
                        'name'
                      ],
                      query,
                      type: 'bool_prefix',
                      default_operator: 'AND'
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
              bool: {
                must: [
                  {
                    query_string: {
                      fields: [
                        'name'
                      ],
                      query,
                      type: 'bool_prefix',
                      default_operator: 'AND'
                    }
                  },
                  {
                    match: {
                      ownerId: _user.profileId
                    }
                  }
                ]
              }
            }
          ]
        }
      }
    ]
    const result = await es.search({
      index: envPrefix + constants.globalChatsIndex,
      body: {
        size: 1000,
        query: {
          bool: {
            must
          }
        },
        highlight: {
          fields: {
            'leftProfile.displayName': { fragment_size: 60, number_of_fragments: 1 },
            'rightProfile.displayName': { fragment_size: 60, number_of_fragments: 1 },
            name: { fragment_size: 60, number_of_fragments: 1 }
          }
        }
      }
    })
    const chats = _.get(result, 'hits.hits', [])

    return Promise.all(chats.map(item => {
      const chat = item._source
      const result = {}
      if (chat.type === 'chat') {
        const chatProfile = chat.rightProfile._id !== _user.profileId ? chat.rightProfile : chat.leftProfile

        result.type = chat.type
        result.chatId = item._id
        result._id = chat.id
        result.avatar = chatProfile.avatar
        result.profileId = chatProfile._id
        result.displayName = chatProfile.displayName
        result._displayName = chatProfile._displayName
        result.typeCode = chatProfile.typeCode
        result.firstMessage = chat.firstMessage
        result.lastMessage = chat.lastMessage
        result.createdAt = chat.createdAt
        result.updatedAt = chat.updatedAt
        result.status = chatProfile.status
        result.relationStatus = chat.status
        result.active = false
        result.highlight = item.highlight
        result.score = item._score
      } else
      if (chat.type === 'group') {
        result.type = chat.type
        result.chatId = item._id
        result._id = chat.id
        result.avatar = chat.avatar
        result.profileId = chat.ownerId
        result.displayName = chat.name
        result.firstMessage = chat.firstMessage
        result.lastMessage = chat.lastMessage
        result.createdAt = chat.createdAt
        result.updatedAt = chat.updatedAt
        result.highlight = item.highlight
        result.score = item._score
      } else
      if (chat.type === 'broadcast') {
        result.type = chat.type
        result.chatId = item._id
        result._id = chat.id
        result.avatar = chat.avatar
        result.profileId = chat.ownerId
        result.displayName = chat.name
        result.firstMessage = chat.firstMessage
        result.lastMessage = chat.lastMessage
        result.createdAt = chat.createdAt
        result.updatedAt = chat.updatedAt
        result.highlight = item.highlight
        result.score = item._score
      }
      return result
    }))
  }

  /**
   * get profile online status
   * @param {*} profileId
   * @returns status
   */
  async getProfileStatus (profileId) {
    const { data } = await rabbitmq.sendAndRead('/ws/status/get', { profileId })
    return data
  }

  /**
   * get multiple profile online status
   * @param {*} profileIds
   * @returns status
   */
  async getMultiProfileStatus (profileIds) {
    const { data } = await rabbitmq.sendAndRead('/ws/status/get', { profileIds })
    return data
  }

  /**
   * push status update
   * @param {*} param0
   */
  async pushStatusUpdate ({ profileId, managerId = '', status, lastUpdate }) {
    const must = [
      {
        bool: {
          should: [
            {
              match: {
                'leftProfile._id': profileId
              }
            },
            {
              match: {
                'leftProfile._id': managerId
              }
            },
            {
              match: {
                'rightProfile._id': profileId
              }
            },
            {
              match: {
                'rightProfile._id': managerId
              }
            }
          ]
        }
      }
    ]
    const result = await es.search({
      index: envPrefix + constants.globalChatsIndex,
      body: {
        size: 1000,
        query: {
          bool: {
            must
          }
        }
      }
    })
    const toProfileIds = _.get(result, 'hits.hits', [])
      .map(item => {
        const chat = item._source
        return ![profileId, managerId].includes(chat.rightProfile._id) ? chat.rightProfile._id : chat.leftProfile._id
      })

    if (status) {
      ctr.message.resetNotificationReminder(profileId)
    }
    this.pushMessage({ toProfileIds, action: 'setProfileStatus', data: { profileId, managerId, status, lastUpdate } })
  }

  /**
   * push chat update to frontend
   * @param {*} param0
   */
  pushMessage ({ toProfileIds, action, data }) {
    const destination = {
      toProfileIds,
      msgObj: {
        service: 'chat',
        module: 'chat',
        action,
        payload: {
          data
        }
      }
    }

    return rabbitmq.send('/ws/send', destination)
  }

  /**
   * receive broadcast message from auth
   * @param {*} param0 {model, data}
   */
  updateFromAuth ({ model, data }) {
    log.info(`Updating ${model} in ES`)
    if (model === 'profile') {
      const profile = data.profile
      this.updateProfileFromAuth(profile)
    } else
    if (model === 'relation') {
      const relation = data.relation
      this.updateRelationFromAuth(relation)
    }
  }

  /**
   * Parse update of relation from service-auth
   * and update in ES index
   *
   * @param {Object} relation
   */
  async updateRelationFromAuth (relation) {
    // dont create chat if relation with self
    if (relation.leftProfileId === relation.rightProfileId) {
      return
    }
    const { data: profiles } = await rabbitmq.sendAndRead('/auth/profile/get', {
      $or: [
        {
          _id: relation.leftProfileId
        },
        {
          _id: relation.rightProfileId
        }
      ]
    })
    const [firstMessage, lastMessage] = await Promise.all([
      ctr.message.firstMessage(relation.leftProfileId, relation.rightProfileId),
      ctr.message.lastMessage(relation.leftProfileId, relation.rightProfileId)
    ])
    const leftProfile = profiles.find(profile => profile._id === relation.leftProfileId)
    const rightProfile = profiles.find(profile => profile._id === relation.rightProfileId)
    const body = {
      id: relation._id,
      type: 'chat',
      leftProfile: this.reduceProfileFields(leftProfile),
      rightProfile: this.reduceProfileFields(rightProfile),
      status: relation.status,
      firstMessage,
      lastMessage,
      createdAt: _.get(lastMessage, 'createdAt', relation.createdAt),
      updatedAt: _.get(lastMessage, 'updatedAt', relation.updatedAt)
    }
    log.info('Updated relation')
    const indexed = await es.index({
      index: envPrefix + constants.globalChatsIndex,
      id: `R-${relation._id}`,
      body: body,
      refresh: true
    })
    const leftChat = await this.getChat({
      _user: {
        profileId: relation.leftProfileId.toString()
      },
      chatId: `R-${relation._id}`
    })
    const rightChat = await this.getChat({
      _user: {
        profileId: relation.rightProfileId.toString()
      },
      chatId: `R-${relation._id}`
    })
    this.pushMessage({
      toProfileIds: [relation.leftProfileId],
      action: 'setChat',
      data: {
        chat: leftChat
      }
    })
    this.pushMessage({
      toProfileIds: [relation.rightProfileId],
      action: 'setChat',
      data: {
        chat: rightChat
      }
    })
    return indexed
  }

  /**
   * remove unwanted properties from parameter
   * @param {*} profile
   * @returns reduced profile
   */
  reduceProfileFields (profile) {
    const profileProperties = [
      '_id',
      'status',
      'typeCode',
      'avatar',
      'person.firstname',
      'person.lastname',
      'person.emails',
      'person.phones',
      'person.mobilePhones',
      'company.name',
      'company.brand',
      'ids',
      'displayName',
      '_displayName',
      'createdAt',
      'updatedAt'
    ]

    return _.pick(profile, profileProperties)
  }

  /**
   * Parse update of profile from service-auth
   * and update in ES index
   *
   * @param {Object} relation
   */
  async updateProfileFromAuth (profile) {
    if (!profile.displayName) {
      return false
    }
    const result = await es.updateByQuery({
      index: envPrefix + constants.globalChatsIndex,
      conflicts: 'proceed',
      refresh: true,
      body: {
        script: {
          source: `
            if(ctx._source.leftProfile._id == params.profile._id) ctx._source.leftProfile = params.profile;
            if(ctx._source.rightProfile._id == params.profile._id) ctx._source.rightProfile = params.profile;
          `,
          params: {
            profile: this.reduceProfileFields(profile)
          },
          lang: 'painless'
        },
        query: {
          bool: {
            must: [
              {
                bool: {
                  should: [
                    {
                      match: {
                        'leftProfile._id': profile._id
                      }
                    },
                    {
                      match: {
                        'rightProfile._id': profile._id
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
    log.info('Updated profiles')
    log.info(result)
    if (result.version_conflicts > 0) {
      return new Promise(resolve => {
        setTimeout(() => {
          this.updateProfileFromAuth(profile).then(resolve)
        }, 1000)
      })
    }
    return !!result.updated
  }

  /**
   * get a profile by id from ES
   * @param {*} data {profileId}
   * @returns profile
   */
  async getFriend ({ profileId }) {
    const result = await es.search({
      index: envPrefix + 'profiles',
      body: {
        size: 1,
        query: {
          bool: {
            should: [
              {
                match: {
                  _id: profileId
                }
              }
            ]
          }
        }
      }
    })
    const profiles = _.get(result, 'hits.hits', [])

    if (!profiles.length) {
      return null
    }
    const profile = _.first(profiles)

    return {
      _id: profile._id,
      displayName: profile._source.displayName || null,
      avatar: profile._source.avatar || null,
      typeCode: profile._source.typeCode || null
    }
  }

  /**
   * get profiles by profileids from ES
   * @param {*} data {profileIds}
   * @returns profiles
   */
  async getFriends ({ profileIds }) {
    const should = []
    profileIds.forEach(profileId => {
      should.push({
        match: {
          _id: profileId
        }
      })
    })
    const result = await es.search({
      index: envPrefix + 'profiles',
      body: {
        size: 1,
        query: {
          bool: {
            should
          }
        }
      }
    })
    const profiles = _.get(result, 'hits.hits', [])

    if (!profiles.length) {
      return []
    }
    return profiles.map(profile => ({
      _id: profile._id,
      displayName: profile._source.displayName || null,
      avatar: profile._source.avatar || null,
      typeCode: profile._source.typeCode || null
    }))
  }

  /**
   * filter active, temporary from profileIds
   * @param {*} profileIds
   * @returns profileIds
   */
  async filterActiveProfiles (profileIds) {
    if (!profileIds.length) return []
    const should = []

    profileIds.forEach(profileId => {
      should.push({
        match: {
          _id: profileId
        }
      })
    })
    const result = await es.search({
      index: envPrefix + 'profiles',
      body: {
        query: {
          bool: {
            must: [
              {
                bool: {
                  should
                }
              }, {
                bool: {
                  should: [
                    {
                      match: {
                        status: 'active'
                      }
                    },
                    {
                      match: {
                        status: 'temporary'
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
    const profiles = _.get(result, 'hits.hits', [])

    return profiles.map(profile => profile._id)
  }

  /**
   * filter active relations
   * @param {*} profileId
   * @param {*} relationProfileIds
   * @returns relations
   */
  async filterActiveRelations (profileId, relationProfileIds) {
    if (!relationProfileIds.length) return []
    const should = []

    relationProfileIds.forEach(profileId => {
      should.push({
        match: {
          leftProfileId: profileId
        }
      })
    })
    const result = await es.search({
      index: envPrefix + 'relations',
      body: {
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
                              leftProfileId: profileId
                            }
                          },
                          {
                            match: {
                              rightProfileId: relationProfileIds.join(' OR ')
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
                              rightProfileId: profileId
                            }
                          },
                          {
                            match: {
                              leftProfileId: relationProfileIds.join(' OR ')
                            }
                          }
                        ]
                      }
                    }
                  ]
                }
              }, {
                bool: {
                  should: [
                    {
                      match: {
                        status: 'active'
                      }
                    },
                    {
                      match: {
                        status: 'temporary'
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
    const relations = _.get(result, 'hits.hits', [])

    return relations.map(relation => {
      return relation._source.leftProfileId === profileId ? relation._source.rightProfileId : relation._source.leftProfileId
    })
  }

  /**
   * get all chatgroups for trainer
   */
  async getCourseTrainerGroups (trainerId) {
    const result = await es.search({
      index: envPrefix + 'course_chat_groups',
      body: {
        query: {
          bool: {
            must: [
              {
                match: {
                  trainerIds: trainerId
                }
              }
            ]
          }
        }
      }
    })
    const chatGroups = _.get(result, 'hits.hits', [])

    return chatGroups.map(item => item._source.chatGroupId)
  }
}

module.exports = ChatController
