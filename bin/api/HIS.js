const axios = require('axios');

const instance = axios.create({
  timeout: 10 * 1000,
  headers: {
    'Content-Type': 'text/plain',
  },
});

exports.getEncounter = async (patientId, params = new URLSearchParams()) => {
  try {
    const {
      data,
    } = instance.post(
      'http://n106035:9080/BCWeb/jaxrs/vghksBC/rtnEnc',
      patientId,
      { params }
    );

    return data;
  } catch (err) {
    console.error(err.response.status);
    console.error(err.response.data);
  }
};

exports.getICDInfo = async (icdCode, params = new URLSearchParams()) => {
  try {
    const {
      data,
    } = instance.post(
      'http://n106035:9080/BCWeb/jaxrs/vghksBC/reqICDInfo',
      icdCode,
      { params }
    );

    return data;
  } catch (err) {
    console.error(err.response.status);
    console.error(err.response.data);
  }
};
