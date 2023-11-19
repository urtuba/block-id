import axios from "axios";

if(!process.env.REACT_APP_BE_PORT) {
  console.warn('REACT_APP_BE_PORT is not set, defaulting to 3000')
}

const makeRequest = axios.create({
  baseURL: `http://localhost:${process.env.REACT_APP_BE_PORT || 3000}/api`,
  timeout: 5000,
});

export default makeRequest;
