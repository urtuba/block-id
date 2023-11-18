const authorizeBlockId = async (req, res, next) => {
  if (!req.headers['block-id-api-key'] || req.headers['block-id-api-key'] !== process.env.BLOCK_ID_API_KEY) {
    return res.status(401).send('Request Without API Key')
  }

  return next()
}

export default authorizeBlockId
