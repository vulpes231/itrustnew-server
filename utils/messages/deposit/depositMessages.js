const { baseTemplate } = require("../../messages");

const getCryptoAddress = (method, settings) => {
  const coinSelected = method.mode;
  const network = method.network;

  let address;

  address =
    coinSelected === "usdt" && network === "trc20"
      ? settings.cryptoWallets["usdtTrc"]
      : settings.cryptoWallets["usdtErc"];

  return coinSelected === "usdt" ? address : settings.cryptoWallets[coin];
};

function buildDepositEmail({ user, transaction, settings }) {
  const paymentDetails =
    transaction?.method?.mode === "bank"
      ? `
            <table style="
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 25px;
            ">
              <tr>
                <td style="padding: 10px 0; color: #666;">
                  Bank Name
                </td>
                <td style="
                  padding: 10px 0;
                  text-align: right;
                  font-weight: bold;
                ">
                  ${settings?.bankDetails?.bankName || "-"}
                </td>
              </tr>
    
              <tr>
                <td style="padding: 10px 0; color: #666;">
                  Account Name
                </td>
                <td style="
                  padding: 10px 0;
                  text-align: right;
                  font-weight: bold;
                ">
                  ${settings?.bankDetails?.accountName || "-"}
                </td>
              </tr>
    
              <tr>
                <td style="padding: 10px 0; color: #666;">
                  Account Number
                </td>
                <td style="
                  padding: 10px 0;
                  text-align: right;
                  font-weight: bold;
                ">
                  ${settings?.bankDetails?.accountNumber || "-"}
                </td>
              </tr>
    
              <tr>
                <td style="padding: 10px 0; color: #666;">
                  Routing Number
                </td>
                <td style="
                  padding: 10px 0;
                  text-align: right;
                  font-weight: bold;
                ">
                  ${settings?.bankDetails?.routing || "-"}
                </td>
              </tr>
    
              <tr>
                <td style="padding: 10px 0; color: #666;">
                  Reference Number
                </td>
                <td style="
                  padding: 10px 0;
                  text-align: right;
                  font-weight: bold;
                ">
                  ${settings?.bankDetails?.reference || "-"}
                </td>
              </tr>
            </table>
          `
      : `
            <table style="
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 25px;
            ">
              <tr>
                <td style="padding: 10px 0; color: #666;">
                  Address
                </td>
    
                <td style="
                  padding: 10px 0;
                  text-align: right;
                  font-weight: bold;
                  word-break: break-all;
                ">
                  ${getCryptoAddress(transaction.method, settings) || "-"}
                </td>
              </tr>
    
              <tr>
                <td style="padding: 10px 0; color: #666;">
                  Network
                </td>
    
                <td style="
                  padding: 10px 0;
                  text-align: right;
                  font-weight: bold;
                  color: green;
                ">
                  ${transaction?.method?.network || "-"}
                </td>
              </tr>
            </table>
          `;

  const content = `
        <h2 style="
          margin-top: 0;
          color: ${BRAND_COLOR};
        ">
          Deposit Requested.
        </h2>
    
        <p>Hello, ${user?.personalInfo?.firstName}</p>
    
        <p>
          Thank you for choosing Itrust Investment.
        </p>
    
        <p>
          We have received your <b>${transaction?.method?.mode}</b> deposit request.
          To proceed, please make a payment to the following
          ${transaction?.method?.mode === "bank" ? "bank details" : "crypto address"}.
        </p>
    
        <div style="
          background: #f4f0ff;
          border-left: 4px solid #5162be;
          padding: 20px;
          border-radius: 8px;
          margin: 30px 0;
        ">
          <p style="
            margin: 0;
            font-size: 22px;
            font-weight: bold;
            color: #5162be;
          ">
            ${user?.currency?.symbol}${transaction?.amount} ${user?.currency?.name}
          </p>
    
          <p style="
            margin: 10px 0 0;
            color: #555;
          ">
            via ${transaction?.method?.mode}
          </p>
        </div>
    
        <h3 style="
          color: #222;
          margin-bottom: 15px;
        ">
          Payment Details
        </h3>
    
        ${paymentDetails}
    
        <table style="
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 25px;
        ">
          <tr>
            <td style="padding: 10px 0; color: #666;">
              Method
            </td>
    
            <td style="
              padding: 10px 0;
              text-align: right;
              font-weight: bold;
            ">
              ${transaction?.method?.mode}
            </td>
          </tr>
    
          <tr>
            <td style="padding: 10px 0; color: #666;">
              Date
            </td>
    
            <td style="
              padding: 10px 0;
              text-align: right;
              font-weight: bold;
            ">
              ${new Date().toLocaleString()}
            </td>
          </tr>
        </table>
    
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
      `;

  return baseTemplate({
    title: "Deposit Confirmation",
    content,
  });
}

function buildDepositApprovedEmail({ user, transaction }) {
  const content = `
        <h2 style="
          margin-top: 0;
          color: ${BRAND_COLOR};
        ">
          Deposit Approved.
        </h2>
    
        <p>Hello, ${user?.personalInfo?.firstName}</p>
        <p>
          We are pleased to inform you that your cash deposit of <b>${user?.currency?.symbol}${transaction?.amount}</b> has been successfully received and processed.
        </p>
        
        <p>
          You can now view the updated balance in your account dashboard.
        </p>
      `;

  return baseTemplate({
    title: "Deposit Approved",
    content,
  });
}

function buildDepositDeclinedEmail({ user, transaction }) {
  const content = `
        <h2 style="
          margin-top: 0;
          color: ${BRAND_COLOR};
        ">
          Deposit Declined.
        </h2>
    
        <p>Hello, ${user?.personalInfo?.firstName}</p>
        <p>
          We regret to inform you that your cash deposit of <b>${user?.currency?.symbol}${transaction?.amount}</b> has been declined.
        </p>
        
        <p>
         If you believe this is an error or require further clarification, please contact our support team at <a href="mailto:support@itrustinvestment.com">
         support@itrustinvestment.com
       </a>
        </p>
        <p>We are here to assist you in every step of the way.</p>
    
      `;

  return baseTemplate({
    title: "Deposit Declined",
    content,
  });
}

module.exports = {
  buildDepositEmail,
  buildDepositApprovedEmail,
  buildDepositDeclinedEmail,
};
