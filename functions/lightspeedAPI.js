const { getLSAPICredentials } = require("./googleSecretManager");
const { PubSub } = require("@google-cloud/pubsub");
const { updateSheetsLastID } = require("./sheets");
const axios = require("axios");
const pubSubClient = new PubSub();

async function publishMessage() {
  const topicNameOrId = "groupech-giftcard-daily";
  const dataBuffer = Buffer.from("NEXT");
  const customAttributes = {
    next: "894195",
  };

  try {
    const messageId = await pubSubClient.topic(topicNameOrId).publish(dataBuffer, customAttributes);
    console.log(`Message ${messageId} published.`);
  } catch (error) {
    console.error(`Received error while publishing: ${error.message}`);
    process.exitCode = 1;
  }
}

async function publishNextParameter(param) {
  const topicNameOrId = "groupech-giftcard-daily";
  const dataBuffer = Buffer.from("NEXT");
  const customAttributes = {
    next: param,
  };

  try {
    const messageId = await pubSubClient.topic(topicNameOrId).publish(dataBuffer, customAttributes);
    console.log(`Message ${messageId} published.`);
  } catch (error) {
    console.error(`Received error while publishing: ${error.message}`);
    process.exitCode = 1;
  }
}

async function pullSalesFromMessage() {
  const subscription = pubSubClient.subscription("groupech-giftcard-daily-sub");

  const messageHandler = async (message) => {
    console.log(`Received message: id ${message.id}, data ${message.data}`);
    if (message.data.toString() === "NEXT") {
      console.log("Got a NEXT message. Will get all sales after ID " + message.attributes.next);
      //   let sales = await getGCSales(message.attributes.next, message);
      message.ack();
      //   let sales = await getGCSales("894195");
      let sales = await getGCSales(message.attributes.next);
      //   console.log(sales);
      //   return sales;
    }
  };

  // Listen for new messages until timeout is hit
  subscription.on("message", messageHandler);
  setTimeout(() => {
    subscription.removeListener("message", messageHandler);
  }, 2 * 1000);
  return true;
}

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const rateLimit = async (response) => {
  const currentLevel = Math.ceil(parseInt(response.headers["x-ls-api-bucket-level"].split("/")[0]));
  const bucketSize = parseInt(response.headers["x-ls-api-bucket-level"].split("/")[1]);
  const dripRate = parseInt(response.headers["x-ls-api-drip-rate"]);
  const cost = 1;

  if (currentLevel + cost >= bucketSize) {
    const overflow = Math.ceil(currentLevel + cost - bucketSize);
    console.log("OVERFLOW OF", overflow);
    const secondsDelay = Math.ceil(overflow / dripRate) + 1;
    console.log("RATE LIMITING...WAITING", overflow, "SECONDS");
    await delay(secondsDelay * 1000);
  }
  //   console.log(bucketLevel, bucketSize, dripRate);
};
const getAccessToken = async () => {
  const { client_id, client_secret, refresh_token } = await getLSAPICredentials();

  const body = {
    client_id,
    client_secret,
    grant_type: "refresh_token",
    refresh_token,
  };
  try {
    const resp = await axios.post("https://cloud.lightspeedapp.com/oauth/access_token.php", body);
    return resp.data.access_token;
  } catch (err) {
    console.log(err);
    return;
  }
};

const getGCSales = async (cursor) => {
  const accessToken = await getAccessToken();
  const newGC = [];
  const usedGC = [];
  let response = "";
  let lastID = cursor;

  // step 2: encode the cursor ID to base 64
  let encodedCursor = Buffer.from("[" + cursor + "]").toString("base64");
  encodedCursor += /*encodedCursor.substring(0, encodedCursor.length - 1) + */ "%3D";
  console.log("encoded cursor", encodedCursor);

  let nextLink = `https://us.merchantos.com/API/V3/Account/88255/DisplayTemplate/Sale.json?sort=saleID&limit=100&after=${encodedCursor}`;

  // step 3: do while loop that keeps paginating until there are no more results
  try {
    do {
      console.log("loop", nextLink);
      response = await axios.get(nextLink, {
        headers: {
          Authorization: "Bearer " + accessToken,
        },
      });

      lastID = response.data.Sale[response.data.Sale.length - 1].saleID;
      console.log("last ID", lastID);
      rateLimit(response);

      response.data.Sale.forEach((sale) => {
        if (sale.hasOwnProperty("SalePayments")) {
          if (!Array.isArray(sale.SalePayments.SalePayment)) {
            sale.SalePayments.SalePayment = [sale.SalePayments.SalePayment];
          }
          sale.SalePayments.SalePayment.forEach((salePayment) => {
            if (salePayment.paymentTypeID === "5" && parseInt(salePayment.amount) < 0) {
              // console.log("got a payment type 5 and negative amount. NEW GC: sale, salepayment", sale.saleID, salePayment.salePaymentID);
              newGC.push([sale.saleID, salePayment.salePaymentID, salePayment.amount, salePayment.CreditAccount.creditAccountID, salePayment.CreditAccount.name, salePayment.CreditAccount.code, sale.timeStamp]);
            } else if (salePayment.paymentTypeID === "5" && parseInt(salePayment.amount) >= 0) {
              // console.log("got a payment type 5 and positive amount. USED GC: sale, salepayment", sale.saleID, salePayment.salePaymentID);
              if (sale.hasOwnProperty("SaleLines")) {
                //   console.log("looking at sale", sale.saleID);
                if (!Array.isArray(sale.SaleLines.SaleLine)) {
                  sale.SaleLines.SaleLine = [sale.SaleLines.SaleLine];
                }
                sale.SaleLines.SaleLine.forEach((saleLine) => {
                  usedGC.push([
                    sale.saleID,
                    salePayment.salePaymentID,
                    salePayment.amount,
                    salePayment.CreditAccount.creditAccountID,
                    salePayment.CreditAccount.name,
                    salePayment.CreditAccount.code,
                    saleLine.itemID,
                    saleLine.hasOwnProperty("Item") ? saleLine.Item.systemSku : "",
                    saleLine.hasOwnProperty("Item") ? saleLine.Item.description : "",
                    saleLine.unitPrice,
                    sale.timeStamp,
                  ]);
                });
              }
            }
          });
        }
      });

      nextLink = response.data["@attributes"].next;
    } while (nextLink !== "");
    console.log("Final Last ID", lastID);
    // step 4: publish message of the last ID so that next cron job resumes from the current cursor position
    // publishNextParameter(lastID);
  } catch (err) {
    console.error(err.message);
  }
  return [lastID, newGC, usedGC];
};

const getGCSalesByIDRange = async (start, end) => {
  const accessToken = await getAccessToken();
  const newGC = [];
  const usedGC = [];
  let response = "";
  let cursor = start;
  let lastID = start;

  // step 2: encode the cursor ID to base 64
  let encodedCursor = Buffer.from("[" + cursor + "]").toString("base64");
  encodedCursor += /*encodedCursor.substring(0, encodedCursor.length - 1) + */ "%3D";
  console.log("encoded cursor", encodedCursor);

  let nextLink = `https://us.merchantos.com/API/V3/Account/88255/DisplayTemplate/Sale.json?sort=saleID&limit=100&after=${encodedCursor}`;

  // step 3: do while loop that keeps paginating until there are no more results
  try {
    do {
      console.log("loop", nextLink);
      response = await axios.get(nextLink, {
        headers: {
          Authorization: "Bearer " + accessToken,
        },
      });

      lastID = response.data.Sale[response.data.Sale.length - 1].saleID;
      console.log("last ID", lastID);
      rateLimit(response);

      response.data.Sale.forEach((sale) => {
        if (sale.hasOwnProperty("SalePayments")) {
          if (!Array.isArray(sale.SalePayments.SalePayment)) {
            sale.SalePayments.SalePayment = [sale.SalePayments.SalePayment];
          }
          sale.SalePayments.SalePayment.forEach((salePayment) => {
            if (salePayment.paymentTypeID === "5" && parseInt(salePayment.amount) < 0) {
              // console.log("got a payment type 5 and negative amount. NEW GC: sale, salepayment", sale.saleID, salePayment.salePaymentID);
              newGC.push([sale.saleID, salePayment.salePaymentID, salePayment.amount, salePayment.CreditAccount.creditAccountID, salePayment.CreditAccount.name, salePayment.CreditAccount.code, sale.timeStamp]);
            } else if (salePayment.paymentTypeID === "5" && parseInt(salePayment.amount) >= 0) {
              // console.log("got a payment type 5 and positive amount. USED GC: sale, salepayment", sale.saleID, salePayment.salePaymentID);
              if (sale.hasOwnProperty("SaleLines")) {
                //   console.log("looking at sale", sale.saleID);
                if (!Array.isArray(sale.SaleLines.SaleLine)) {
                  sale.SaleLines.SaleLine = [sale.SaleLines.SaleLine];
                }
                sale.SaleLines.SaleLine.forEach((saleLine) => {
                  usedGC.push([
                    sale.saleID,
                    salePayment.salePaymentID,
                    salePayment.amount,
                    salePayment.CreditAccount.creditAccountID,
                    salePayment.CreditAccount.name,
                    salePayment.CreditAccount.code,
                    saleLine.itemID,
                    saleLine.hasOwnProperty("Item") ? saleLine.Item.systemSku : "",
                    saleLine.hasOwnProperty("Item") ? saleLine.Item.description : "",
                    saleLine.unitPrice,
                    sale.timeStamp,
                  ]);
                });
              }
            }
          });
        }
      });

      nextLink = response.data["@attributes"].next;
    } while (lastID < end);
    console.log("Final Last ID", lastID);
    // step 4: publish message of the last ID so that next cron job resumes from the current cursor position
    // publishNextParameter(lastID);
  } catch (err) {
    console.error(err.message);
  }
  return [lastID, newGC, usedGC];
};

module.exports = { getGCSales, getGCSalesByIDRange, pullSalesFromMessage, publishMessage, publishNextParameter };
