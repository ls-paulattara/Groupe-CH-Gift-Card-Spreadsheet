const {SecretManagerServiceClient} = require('@google-cloud/secret-manager');
const client = new SecretManagerServiceClient();
const LS_API_KEY = 'projects/929241011807/secrets/GROUPECH_LS_API_KEY/versions/latest';
const SHEETS_API_LWY = 'projects/929241011807/secrets/GROUPECH_SHEETS_API_CREDENTIALS/versions/3'


const getLSAPICredentials = async () => {
  const [version] = await client.accessSecretVersion({
    name: LS_API_KEY,
  });
  const responsePayload = version.payload.data.toString();
  const {client_id, client_secret, refresh_token} = JSON.parse(responsePayload);
  return {client_id, client_secret, refresh_token};
};


const getSheetsCredentials = async () => {
  const [version] = await client.accessSecretVersion({
    name: SHEETS_API_LWY,
  });
  const responsePayload = version.payload.data.toString();
  const {client_email, client_id, private_key} = JSON.parse(responsePayload);
  return {client_email, client_id, private_key};
};

module.exports = {getLSAPICredentials, getSheetsCredentials};