const BlockIdGrantCode = require('../models/block-id-grant-code');

module.exports = (req, res) => {
  try {
    const newGrantCode = new BlockIdGrantCode();

    res.status(201).send({ code: newGrantCode.code })
  } catch (err) {
    console.log(err);
    res.status(500).send('Internal Server Error');
  }
};