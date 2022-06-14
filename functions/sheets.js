const { google } = require("googleapis");
const { getSheetsCredentials } = require("./googleSecretManager");
// const spreadsheetId = "1o-V90REM2NAl51gEa2NWi9DdRFTN8j76jk-BqOufKyI";
const spreadsheetId = "15ha64j5-owX58w5RX9nBvpNszYNT2RIh3ipB-9bZqWE";

// let jwtClient;
// let gsAPI;

const authenticate = async () => {
  let { client_email, private_key } = await getSheetsCredentials();
  const jwtClient = new google.auth.JWT(client_email, null, private_key, ["https://www.googleapis.com/auth/spreadsheets"]);
  jwtClient.authorize((err, tokens) => {
    if (err) {
      console.log(err);
      return;
    } else {
      return jwtClient;
    }
  });
};

const getLastID = async () => {
  const gsAPI = await getAuth();

  const options = {
    spreadsheetId,
    // range: "Config!B1",
    range: "Config!C:B",
  };

  try {
    const response = await gsAPI.spreadsheets.values.get(options);
    const lastRow = response.data.values[response.data.values.length - 1][0];
    return lastRow;
  } catch (err) {
    console.log(err);
    return;
  }
};

const getAuth = async () => {
  let { client_email, private_key } = await getSheetsCredentials();
  let jwtClient = new google.auth.JWT(client_email, null, private_key, ["https://www.googleapis.com/auth/spreadsheets"]);
  jwtClient.authorize((err, tokens) => {
    if (err) {
      console.log(err);
      return;
    }
  });

  const gsAPI = google.sheets({ version: "v4", auth: jwtClient });
  return gsAPI;
};
const updateSheetsLastID = async (saleID) => {
  const gsAPI = await getAuth();

  const date = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  gsAPI.spreadsheets.values.append(
    {
      spreadsheetId,
      range: "Config!A1",
      valueInputOption: "USER_ENTERED",
      resource: {
        values: [[date, saleID]],
      },
    },
    (err, result) => {
      if (err) {
        console.log(err.message);
      }
      return;
    }
  );
};

const postUsedGCData = async (usedGC) => {
  const gsAPI = await getAuth();
  gsAPI.spreadsheets.values.append(
    {
      spreadsheetId,
      range: "used_gc!A2",
      valueInputOption: "USER_ENTERED",
      // insertDataOption: "INSERT_ROWS",
      resource: {
        values: usedGC,
      },
    },
    (err, result) => {
      if (err) {
        console.log(err.message);
      }
      return;
    }
  );
};

const postNewGCData = async (newGC) => {
  const gsAPI = await getAuth();
  gsAPI.spreadsheets.values.append(
    {
      spreadsheetId,
      range: "new_gc!A2",
      valueInputOption: "USER_ENTERED",
      // insertDataOption: "INSERT_ROWS",
      resource: {
        values: newGC,
      },
    },
    (err, result) => {
      if (err) {
        console.log(err.message);
      }
      return;
    }
  );
};

module.exports = { authenticate, getLastID, updateSheetsLastID, postUsedGCData, postNewGCData };
