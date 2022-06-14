const functions = require("firebase-functions");

const { getGCSales, getGCSalesByIDRange } = require("./lightspeedAPI");
const { getLastID, updateSheetsLastID, postUsedGCData, postNewGCData } = require("./sheets");
// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

exports.manualGroupeCHGiftCardCronJob = functions.runWith({ timeoutSeconds: 540 }).https.onRequest(async (request, response) => {
  const id = await getLastID();
  console.log("GOT ID", id);

  const result = await getGCSales(id);
  // const result = await getGCSalesByIDRange("859387", "860000");

  const lastID = result[0];
  const newGC = result[1];
  const usedGC = result[2];

  await updateSheetsLastID(lastID);
  await postNewGCData(newGC);
  await postUsedGCData(usedGC);
  response.json({ lastIDFetched: lastID });

  //   const res = await pullSalesFromMessage();
});

exports.pullGroupeCHGiftCards = functions
  .runWith({ timeoutSeconds: 540 })
  .pubsub.schedule("59 23 * * *") /* midnight */
  .timeZone("America/New_York")
  .onRun(async (context) => {
    console.log("Starting 11:59pm cron job");

    const id = await getLastID();
    console.log("GOT ID", id);

    const result = await getGCSales(id);
    const lastID = result[0];
    const newGC = result[1];
    const usedGC = result[2];

    await updateSheetsLastID(lastID);
    await postNewGCData(newGC);
    await postUsedGCData(usedGC);
    return true;
  });
