const { db, ctr } = require('@cowellness/cw-micro-service')()
const membersSchema = require('./subschema/members.subschema')
const Schema = db.chat.Schema

const groupsSchema = new Schema(
  {
    status: {
      type: String,
      enum: ['active', 'deleted']
    },
    ownerId: {
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
    avatar: {
      type: Object
    },
    filter: {
      type: Object
    },
    members: [
      membersSchema
    ]
  },
  { timestamps: true }
)

groupsSchema.post('save', doc => ctr.group.updateEsIndex(doc))
groupsSchema.post('findOneAndUpdate', doc => ctr.group.updateEsIndex(doc))

module.exports = db.chat.model('Group', groupsSchema)
