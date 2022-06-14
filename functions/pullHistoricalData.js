const { getGCSalesByIDRange } = require("./lightspeedAPI");
const { postUsedGCData, postNewGCData, updateSheetsLastID } = require("./sheets");

const runScript = async () => {
  //   const result = await getGCSalesByIDRange("859387", "880000");
  // got stuck at 863894
  //   const result = await getGCSalesByIDRange("863694", "880000");
  // get a 401
  //   const result = await getGCSalesByIDRange("879522", "880000");
  //   const result = await getGCSalesByIDRange("879081", "896000");
  const result = await getGCSalesByIDRange("895800", "897350");
  const lastID = result[0];
  const newGC = result[1];
  const usedGC = result[2];

  await postNewGCData(newGC);
  await postUsedGCData(usedGC);
  await updateSheetsLastID(lastID);
  return;
};

runScript();
