const User = require('../../models/user');

/**
 * @swagger
 * /api/user:
 *   post:
 *     summary: Create a new user.
 *     tags:
 *       - User
 *     responses:
 *       201:
 *         description: User created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   description: The unique ID of the newly created user.
 */
module.exports = async (req, res) => { 
  const user = await User.create({})

  res.status(201).send({
    id: user._id
  })
}