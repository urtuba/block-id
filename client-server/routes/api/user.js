const User = require('../../models/user')

/**
 * @swagger
 * /api/user/{userId}:
 *   get:
 *     summary: Retrieve a single user
 *     description: Retrieve a single user by their unique ID.
 *     tags: [User]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         description: Unique ID of the user to retrieve.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: A single user.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   description: The user ID.
 *                   example: "12345"
 *                 walletAddress:
 *                  type: string
 *                  description: The user's wallet address.
 *       404:
 *         description: User not found.
 */
module.exports = async (req, res) => {
  const { userId } = req.params

  const user = await User.findById(userId)
  if (!user) {
    return res.status(404).send('User Not Found')
  }

  res.status(200).send({
    id: user._id,
    walletAddress: user.walletAddress
  })
}