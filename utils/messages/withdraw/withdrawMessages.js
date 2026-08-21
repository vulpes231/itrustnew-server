const { baseTemplate, BRAND_COLOR } = require("../../messages");

function buildWithdrawalEmail({ user, transaction }) {
  const content = `
          <h2 style="
            margin-top: 0;
            color: ${BRAND_COLOR};
          ">
            Withdrawal Request Confirmation
          </h2>
      
          <p>Hello, ${user?.personalInfo?.firstName}</p>
      
          <p>
            Thank you for choosing Itrust Investment.
          </p>
      
          <p>
            We have received your <b>${transaction?.method?.mode}</b> withdrawal request of ${user?.currency?.symbol}${transaction?.amount}.
           and it is currently being processed.
          </p>
      
          <h3 style="
          color: #222;
          margin-bottom: 15px;
        ">
          Processing Timeline
        </h3>
        <p><b>Crypto Withdrawals:</b> typically processed in few minutes or withing <b>24 hours</b> depending on the blockchain network.</p>
        <p><b>Bank Transfers:</b> may take <b>2-3 business days</b></p>
      
      
       
          <p>
            You will receive an update once your transaction has been fully processed.
          </p>
      
          <p>
            Thank you for choosing Itrust Investment.
          </p>
        `;

  return baseTemplate({
    title: "Withdrawal Confirmation",
    content,
  });
}

function buildWithdrawalApprovedEmail({ user, transaction }) {
  const content = `
          <h2 style="
            margin-top: 0;
            color: ${BRAND_COLOR};
          ">
            Withdrawal Approved.
          </h2>
      
          <p>Hello, ${user?.personalInfo?.firstName}</p>
          <p>
            Your <b>${transaction?.method?.mode}</b> withdrawal of <b>${user?.currency?.symbol}${transaction?.amount}</b> has been successfully processed.
          </p>

          <h3 style="
          color: #222;
          margin-bottom: 15px;
        ">
          Details
        </h3>
        <p><b>Amount:</b> ${user?.currency?.symbol}${transaction?.amount}</p>
        <p><b>Destination:</b> ${transaction?.method}</p>
          
          <p>
            Please allow standard network or bank processing times for funds to reflect.
          </p>
          <p>Thank you for investing with us.</p>
        `;

  return baseTemplate({
    title: "Withdrawal Approved",
    content,
  });
}

function buildWithdrawalDeclinedEmail({ user, transaction }) {
  const content = `
          <h2 style="
            margin-top: 0;
            color: ${BRAND_COLOR};
          ">
            Deposit Declined.
          </h2>
      
          <p>Hello, ${user?.personalInfo?.firstName}</p>
          <p>
            We regret to inform you that your <b>${transaction?.method?.mode}</b> withdrawal request of <b>${user?.currency?.symbol}${transaction?.amount}</b> has been declined.
          </p>
          
          <p>
           For more information or to esolve this issue, please contact our support team at <a href="mailto:support@itrustinvestment.com">
           support@itrustinvestment.com
         </a>
          </p>
          <p>We are here to help.</p>
      
        `;

  return baseTemplate({
    title: "Withdrawal Declined",
    content,
  });
}

module.exports = {
  buildWithdrawalEmail,
  buildWithdrawalApprovedEmail,
  buildWithdrawalDeclinedEmail,
};
