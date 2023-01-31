const { db, ctr } = require('@cowellness/cw-micro-service')()
const membersSchema = require('./subschema/members.subschema')
const Schema = db.chat.Schema

const broadcastsSchema = new Schema(
  {
    ownerId: {
      type: String
    },
    managedBy: {
      type: String
    },
    chatId: {
      type: String
    },
    name: {
      type: String
    },
    description: {
      type: String
    },
    filter: {
      type: Object
    },
    avatar: {
      type: Object
    },
    members: [
      membersSchema
    ]
  },
  { timestamps: true }
)

broadcastsSchema.post('save', doc => ctr.broadcast.updateEsIndex(doc))
broadcastsSchema.post('findOneAndUpdate', doc => ctr.broadcast.updateEsIndex(doc))

module.exports = db.chat.model('Broadcast', broadcastsSchema)
