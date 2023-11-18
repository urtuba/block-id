const User = require('../models/user');
const BlockIdGrantCode = require('../models/block-id-grant-code');

module.exports = async (req, res) => {
  const { walletAddress } = req.body;

  try {
    const user = await User.findOne({ walletAddress });
    if (!user) {
      return res.status(404).send('User Not Found');
    }

    const newGrantCode = await BlockIdGrantCode.create({user: user._id});

    res.status(201).send({ code: newGrantCode.code })
  } catch (err) {
    console.log(err);
    res.status(500).send('Internal Server Error');
  }
};