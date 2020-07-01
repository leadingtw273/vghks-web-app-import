require('better-logging')(console);

const ReceiveEncounter = require('./lib/DataParse/ReceiveEncounter');
const fs = require('fs');

String.prototype.trimReceive = function () {
  if (this.valueOf() === ' / ') return '';
  return this.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
};

const receiveObject = JSON.parse(fs.readFileSync('file/input.json'));

ReceiveEncounter(receiveObject).then((val) => {
  fs.writeFileSync('file/output.json', JSON.stringify(val), { flag: 'w+' });
});
