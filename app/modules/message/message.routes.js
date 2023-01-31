const { ctr, _, log } = require('@cowellness/cw-micro-service')()
const validationSchema = require('./message.schema')

module.exports = async function (fastify, opts, done) {
  fastify.post('/init', validationSchema.initChat, async (request, reply) => {
    const { firstname, email, phone, gymId, dob, pin } = request.body
    const gymProfile = await ctr.message.findGymById(gymId)

    if (!gymProfile) {
      return reply.cwsendFail({
        message: 'gym not found'
      })
    }
    const profile = await ctr.message.getProfile({ firstname, email, phone, dob })
    const birthDate = _.get(profile, 'person.birth.date')
    const hasPassword = !!profile.password
    const dobMatched = dob && birthDate && dob === birthDate
    let isValidPin = null

    if (pin) {
      isValidPin = await ctr.message.validatePin(profile, pin)
      log.info('isValidPin: %s', isValidPin)
    }
    if (!isValidPin) {
      if (dob && !dobMatched) {
        const isPinSent = await ctr.message.sendPin(gymProfile, profile)
        log.info('isPinSent: %j', isPinSent)
        if (isPinSent.sent) {
          return reply.cwsendFail({
            message: 'Authentication failed',
            data: {
              auth: false,
              pin: true,
              via: isPinSent.type
            }
          })
        }
        if (hasPassword) {
          return reply.cwsendFail({
            message: 'Authentication failed',
            data: {
              auth: false,
              passwordBased: true
            }
          })
        }
      }
    }

    if (!['temporary', 'active'].includes(profile.status)) {
      return reply.cwsendFail({
        message: 'Authentication failed',
        data: {
          auth: false,
          passwordBased: false
        }
      })
    }
    if (!isValidPin && profile.status === 'active' && !dobMatched) {
      return reply.cwsendFail({
        message: 'Authentication failed',
        data: {
          auth: false,
          passwordBased: false
        }
      })
    }
    const relation = await ctr.message.findOrCreateRelation({
      leftProfileId: gymId,
      rightProfileId: profile._id
    })
    const sessionId = await ctr.message.createChatPluginKey({
      profile,
      gymId
    })

    await ctr.message.chatPluginFirstMessage({
      sessionId,
      profile,
      gymId,
      relation
    })
    return reply.cwsendSuccess({
      data: {
        firstname: profile.person.firstname,
        lastname: profile.person.lastname,
        displayName: profile.displayName,
        typeCode: profile.typeCode,
        gymId,
        sessionId
      }
    })
  })

  fastify.get('/session', validationSchema.checkSessionForPlugin, async (request, reply) => {
    const sessionId = request.query.sessionId
    const chatSession = await ctr.message.checkChatPluginKey(sessionId)

    if (!chatSession) {
      return reply.cwsendFail({
        message: 'session expired'
      })
    }
    const { profile, gymId } = chatSession

    reply.cwsendSuccess({
      data: {
        firstname: profile.person.firstname,
        lastname: profile.person.lastname,
        displayName: profile.displayName,
        typeCode: profile.typeCode,
        gymId
      }
    })
  })

  fastify.get('/getMessages', validationSchema.getMessagesForPlugin, async (request, reply) => {
    const sessionId = request.query.sessionId
    const chatSession = await ctr.message.checkChatPluginKey(sessionId)

    if (!chatSession) {
      return reply.cwsendFail({
        message: 'session expired'
      })
    }
    const fromMessageId = request.query.fromMessageId || null
    const limit = request.query.limit || null
    const { profile, gymId } = chatSession
    const userId = profile._id
    let timeout = false

    setTimeout(() => {
      timeout = true
    }, 30000)
    const checkNewMessages = async () => {
      const messages = await ctr.message.getMessagesForPlugin({
        sessionId,
        userId,
        gymId,
        fromMessageId,
        limit
      })
      if (messages.length || timeout) {
        clearInterval(intervalId)
        reply.cwsendSuccess({
          data: {
            messages
          }
        })
      }
    }
    const intervalId = setInterval(checkNewMessages, 5000)
    checkNewMessages()
  })

  fastify.post('/sendMessage', validationSchema.sendMessageForPlugin, async (request, reply) => {
    const sessionId = request.body.sessionId
    const chatSession = await ctr.message.checkChatPluginKey(sessionId)

    if (!chatSession) {
      return reply.cwsendFail({
        message: 'session expired'
      })
    }
    const text = request.body.text
    const frontId = request.body.frontId
    const { profile, gymId } = chatSession
    const userId = profile._id
    try {
      ctr.message.getMessagesForPlugin({
        sessionId,
        userId,
        gymId
      }).then(messages => {
        if (messages.length === 1) {
          // if first message from gym exist, send cron for auto message
          ctr.message.chatPluginAutoMessageCron({ profile, gymId, userId, sessionId })
        }
      })

      const message = await ctr.message.sendMessageForPlugin({
        sessionId,
        frontId,
        userId,
        gymId,
        text
      })

      reply.cwsendSuccess({
        data: {
          message
        }
      })
    } catch (error) {
      reply.cwsendFail({
        data: {
          message: error.message
        }
      })
    }
  })

  fastify.post('/login', validationSchema.tokenSchema, async (request, reply) => {
    const { token, gymId } = request.body
    const profileId = await ctr.message.chatPluginLogin(token)

    if (!profileId) {
      return reply.cwsendFail({
        message: 'Invalid token'
      })
    }
    const profile = await ctr.message.getProfileByFilter({
      _id: profileId
    })

    const relation = await ctr.message.findOrCreateRelation({
      leftProfileId: gymId,
      rightProfileId: profileId
    })
    const sessionId = await ctr.message.createChatPluginKey({
      profile,
      gymId
    })
    await ctr.message.chatPluginFirstMessage({
      sessionId,
      profile,
      gymId,
      relation
    })
    return reply.cwsendSuccess({
      data: {
        firstname: profile.person.firstname,
        lastname: profile.person.lastname,
        displayName: profile.displayName,
        typeCode: profile.typeCode,
        gymId,
        sessionId
      }
    })
  })

  fastify.get('/plugin-settings/:gymId', validationSchema.pluginSettings, async (request, reply) => {
    const gymId = request.params.gymId
    const gym = await ctr.message.findGymById(gymId)

    reply.header('Access-Control-Allow-Origin', '*')
    reply.header('Access-Control-Allow-Methods', 'GET')

    return reply.cwsendSuccess({
      data: {
        settings: _.get(gym, 'company.chatPluginSettings', null)
      }
    })
  })

  fastify.post('/logout', validationSchema.pluginLogout, async (request, reply) => {
    const sessionId = request.body.sessionId
    await ctr.message.removeChatPluginKey(sessionId)

    return reply.cwsendSuccess({
      data: {
        loggedOut: true
      }
    })
  })
}
