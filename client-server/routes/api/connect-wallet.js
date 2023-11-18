const User = require('../../models/user')

module.exports = async (req, res) => {
  const { id } = req.body
  const { walletAddress } = req.body
  if (!id) {
    return res.status(400).send('Missing User Id')
  }
  if (!walletAddress) {
    return res.status(400).send('Missing Wallet Address')
  }
  try {
    const user = await User.findById(id)
    if (!user) {
      return res.status(404).send('User Not Found')
    }

    user.walletAddress = walletAddress
    await user.save()
    
    res.status(200).send('OK')
  } catch (err) {
    console.log(err)
    res.status(500).send('Internal Server Error')
  }
})
