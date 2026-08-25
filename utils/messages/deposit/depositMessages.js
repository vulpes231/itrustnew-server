const { capitalize } = require("lodash");
const { baseTemplate, BRAND_COLOR } = require("../../messages");

const getCryptoAddress = (method, settings) => {
  const coinSelected = method.mode;
  const network = method.network;

  let address;

  address =
    coinSelected === "usdt" && network === "trc20"
      ? settings.cryptoWallets["usdtTrc"]
      : settings.cryptoWallets["usdtErc"];

  return coinSelected === "usdt"
    ? address
    : settings.cryptoWallets[coinSelected];
};

function buildDepositEmail({ user, transaction, settings }) {
  const paymentDetails = `
            <p>  ${getCryptoAddress(transaction.method.mode, settings) || "-"}</p>
          
          `;

  const content = `
       
    
        <h3     margin: 0 0 8px 0;
        color: ${BRAND_COLOR};
        font-size: 15px;
        line-height: 1.3;
        font-weight: 600;>Hello, ${capitalize(user?.personalInfo?.firstName)}</h3>
    
        <p>
          Thank you for choosing Itrust Investment.
        </p>
    
        <p>
          We have received your <b>${transaction?.method?.mode}</b> deposit request of ${transaction?.amount} in ${user?.currency?.symbol}.
          To proceed, please make a payment to the following
          ${transaction?.method?.mode === "bank" ? "bank details" : "crypto address"}.
        </p>
    
      
    
        <h3 style="
          color: #222;
          margin-bottom: 15px;
        ">
          ${transaction?.method?.mode === "bank" ? "" : "Payment Address"}
        </h3>
    
        ${paymentDetails}
    
      
    
        <p>
          Once your payment is received, we will process your deposit
          promptly and notify you of further updates.
        </p>
    
        <p>
          If you have any questions or need assistance, feel free to
          reach out to us at
          <a href="mailto:support@itrustinvestment.com">
            support@itrustinvestment.com
          </a>
        </p>
        <div >
            <p>Best regards</p>
            <p>Itrust Investment Team</p>
        </div>
      `;

  return baseTemplate({
    content,
  });
}

function buildDepositApprovedEmail({ user, transaction }) {
  const content = `
      

        <h3 style="
        margin: 0 0 8px 0;
        color: ${BRAND_COLOR};
        font-size: 15px;
        line-height: 1.3;
        font-weight: 600;
        ">
          Hello, ${capitalize(user?.personalInfo?.firstName)}
        </h3>

        <p style="
          margin: 0 0 16px 0;
          font-size: 15px;
          line-height: 1.7;
        ">
          We are pleased to inform you that your cash deposit of
          <b>${transaction?.amount} ${user?.currency?.symbol}</b>
          has been successfully received and processed.
        </p>

        <p style="
          margin: 0;
          font-size: 15px;
          line-height: 1.7;
        ">
          You can now view the updated balance in your account dashboard.
        </p>
        <div>
            <p>Best regards</p>
            <p>Itrust Investment Team</p>
        </div>
      `;

  return baseTemplate({
    content,
  });
}

function buildDepositDeclinedEmail({ user, transaction }) {
  const content = `
       

        <h3 style="
        margin: 0 0 8px 0;
        color: ${BRAND_COLOR};
        font-size: 15px;
        line-height: 1.3;
        font-weight: 600;
        ">
          Hello, ${capitalize(user?.personalInfo?.firstName)}
        </h3>

        <p style="
          margin: 0 0 16px 0;
          font-size: 15px;
          line-height: 1.7;
        ">
          We regret to inform you that your cash deposit of
          <b>${transaction?.amount} ${user?.currency?.symbol}</b>
          has been declined.
        </p>

        <p style="
          margin: 0 0 16px 0;
          font-size: 15px;
          line-height: 1.7;
        ">
          If you believe this is an error or require further clarification,
          please contact our support team at
          <a href="mailto:support@itrustinvestment.com">
            support@itrustinvestment.com
          </a>.
        </p>

        <p style="
          margin: 0;
          font-size: 15px;
          line-height: 1.7;
        ">
          We are here to assist you every step of the way.
        </p>
        <div>
            <p>Best regards</p>
            <p>Itrust Investment Team</p>
        </div>
      `;

  return baseTemplate({
    content,
  });
}

module.exports = {
  buildDepositEmail,
  buildDepositApprovedEmail,
  buildDepositDeclinedEmail,
};
