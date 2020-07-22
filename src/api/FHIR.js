const axios = require('axios');

const instance = axios.create({
  baseURL: 'https://hapi.fhir.tw/fhir',
  timeout: 10 * 1000,
});

exports.getResource = async (resourceType, params = new URLSearchParams()) => {
  try {
    const { data } = instance.get(`/${resourceType}`, { params });
    return data;
  } catch (err) {
    console.error(err.response.status);
    console.error(err.response.data);
  }
};

exports.postResource = async (
  resourceType,
  payload,
  params = new URLSearchParams()
) => {
  try {
    const { data } = await instance.post(`/${resourceType}`, payload, {
      params,
    });
    return data.id;
  } catch (err) {
    console.error(err.response.status);
    console.error(err.response.data);
  }
};

exports.getId = async (
  resourceType,
  identifier,
  system,
  params = new URLSearchParams()
) => {
  try {
    if (identifier === '') return null;

    if (system != null) {
      params.append('identifier', `${system}|${identifier}`);
    } else {
      params.append('identifier', identifier);
    }

    const { data: resData } = await instance.get(`/${resourceType}`, {
      params,
    });
    const { total, entry } = resData;
    if (total === 0) return null;

    return entry[entry.length - 1].resource.id;
  } catch (err) {
    if (err.response != null) {
      console.error(err.response.status);
      console.error(err.response.data);
    }
  }
};
