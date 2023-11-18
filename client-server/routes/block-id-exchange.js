const IdentityVerification = require('../models/identity-verification')

module.exports = async (req, res) => {
  const { code } = req.headers
  if (!code) {
    return res.status(400).send('Missing Code')
  }

  try {
    const id = await IdentityVerification.findOne({ code })

    res.status(200).send({
      firstName: id.firstName,
      lastName: id.lastName,
      birthDate: id.birthDate,
      identityNumber: id.identityNumber,
      nationality: id.nationality
    })
  } catch (err) {
    console.log(err)
    res.status(500).send('Internal Server Error')
  }
}