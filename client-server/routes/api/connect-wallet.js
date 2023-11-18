const User = require('../../models/user')

/**
 * @swagger
 * /api/user/wallet-address:
 *   put:
 *     summary: Connect a wallet to a user.
 *     tags:
 *       - User
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: The user's ID.
 *               walletAddress:
 *                 type: string
 *                 description: The wallet address to connect to the user.
 *     responses:
 *       200:
 *         description: User's wallet connected successfully.
 *       400:
 *         description: Bad request. Missing user ID or wallet address.
 *       404:
 *         description: User not found.
 *       500:
 *         description: Internal Server Error.
 */
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
}
