const User = require('../../models/user');

module.exports = async (req, res) => { 
  const user = await User.create()

  res.status(201).send({
    id: user._id
  })
}