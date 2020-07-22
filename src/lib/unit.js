const dayjs = require('dayjs');

function formatDateTime(dateTime) {
  return dayjs(dateTime, 'YYYY-MM-DD / hh:mm:ss').format('YYYY-MM-DDThh:mm:ss');
}

function formatTime(time) {
  if (time === '') return '00:00:00';
  return time.replace(/ /g, '');
}

function makeReferenceList(resourceType, idList) {
  return idList.map((id) => ({
    reference: `${resourceType}/${id}`,
  }));
}

module.exports = {
  formatDateTime,
  formatTime,
  makeReferenceList,
};
