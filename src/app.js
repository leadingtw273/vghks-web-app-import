// require('better-logging')(console);

const ReceiveEncounter = require('./lib/DataParse/ReceiveEncounter');
const fs = require('fs');

const importList = ['2275118', '2855336', '14091691', '14895057'];
async function main() {
  // for (let i = 0; i < receiveObject.length; i++) {
  //   await ReceiveEncounter(receiveObject[i]).then((val) => {
  //     fs.writeFileSync(`file/output_${i}.json`, JSON.stringify(val), {
  //       flag: 'w+',
  //     });
  //   });
  // }

  for (let y = 0; y < importList.length; y++) {
    console.log(`[Import] ${importList[y]} file`);

    const receiveObject = JSON.parse(
      fs.readFileSync(`file/${importList[y]}_rtnEnc.json`)
    );
    for (let i = 0; i < receiveObject.length; i++) {
      const { outputResult, idCollection } = await ReceiveEncounter(
        receiveObject[i]
      );
      console.log(idCollection);
      fs.writeFileSync(
        `file/${importList[y]}_${i + 1}_output.json`,
        JSON.stringify(outputResult),
        {
          flag: 'w+',
        }
      );
      console.log('---------------------------------');
    }
  }
}

main();
