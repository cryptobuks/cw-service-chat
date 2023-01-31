process.env.NODE_ENV = 'production'
const config = require('config')
config.fastify.port = 0
const cw = require('@cowellness/cw-micro-service')(config)
const chatConstants = require('../modules/chat/chat.constants')
const messagesConstants = require('../modules/message/message.constants')
cw.autoStart().then(async () => {
  try {
    const es = cw.es
    const messageIndexExist = await es.indices.exists({
      index: cw.envPrefix + messagesConstants.globalMessagesIndex
    })

    if (!messageIndexExist) {
      console.log('Message index doesnt exist, creating...')
      await es.indices.create({
        index: cw.envPrefix + messagesConstants.globalMessagesIndex
      })
    }
    const chatIndexExist = await es.indices.exists({
      index: cw.envPrefix + chatConstants.globalChatsIndex
    })
    if (!chatIndexExist) {
      console.log('Chat index doesnt exist, creating...')
      await es.indices.create({
        index: cw.envPrefix + chatConstants.globalChatsIndex,
        body: {
          settings: {
            analysis: {
              analyzer: {
                email_analyzer: {
                  type: 'custom',
                  tokenizer: 'uax_url_email',
                  filter: [
                    'lowercase',
                    'stop'
                  ]
                }
              }
            }
          },
          mappings: {
            properties: {
              'leftProfile.person.emails.email': {
                type: 'text',
                analyzer: 'email_analyzer'
              },
              'rightProfile.person.emails.email': {
                type: 'text',
                analyzer: 'email_analyzer'
              }
            }
          }
        }
      })
    }
    console.log('finished')
    process.exit()
  } catch (error) {
    console.log(error)
  }
})
