const swaggerJsdoc = require('swagger-jsdoc');

const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'Express API',
      version: '1.0.0',
      description: 'An exchange API with BlockID integration',
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3000}}`,
        description: 'Development server',
      },
    ],
  },
  apis: ['./routes/*/*.js'], // Path to the API docs
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);

module.exports = swaggerDocs;
