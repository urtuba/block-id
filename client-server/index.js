const express = require("express");
const bodyParser = require("body-parser");
const swaggerUi = require("swagger-ui-express");

const connectDb = require("./utils/db");
const blockIdRouter = require("./routes/block-id/router");
const apiRouter = require("./routes/api/router");
const swaggerDocs = require("./swagger");
const cors = require("cors");

connectDb();
const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

// Allow all
const corsOptions = {
  origin: "*",
  credentials: true,
};

app.use(cors(corsOptions));

app.get("/health", (req, res) => {
  res.send({ status: "ok" });
});
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));
app.use("/block-id", blockIdRouter);
app.use("/api", apiRouter);

app.listen(port, () =>
  console.log(`Server up, swagger is ready at http://localhost:${port}`)
);
