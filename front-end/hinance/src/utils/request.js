import axios from "axios";

const makeRequest = axios.create({
  baseURL: "http://localhost:3000/api",
  timeout: 5000,
});

export default makeRequest;
