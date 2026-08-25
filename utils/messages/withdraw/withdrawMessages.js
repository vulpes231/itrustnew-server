const { capitalize } = require("lodash");
const { baseTemplate, BRAND_COLOR } = require("../../messages");

function buildWithdrawalEmail({ user, transaction }) {
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
          Thank you for choosing Itrust Investment.
        </p>

        <p style="
          margin: 0 0 20px 0;
          font-size: 15px;
          line-height: 1.7;
        ">
          We have received your <b>${transaction?.method?.mode}</b>
          withdrawal request of
          <b> ${transaction?.amount} ${user?.currency?.symbol}</b>
          and it is currently being processed.
        </p>

        <h3 style="
          margin: 0 0 12px 0;
          font-size: 18px;
          font-weight: 600;
        ">
          Processing Timeline
        </h3>

        <p style="
          margin: 0 0 4px 0;
          font-size: 15px;
          line-height: 1.7;
        ">
          <b>Crypto Withdrawals:</b> typically processed within a few minutes
          or within <b>24 hours</b>, depending on the blockchain network.
        </p>

        <p style="
          margin: 0 0 2px 0;
          font-size: 15px;
          line-height: 1.7;
        ">
          <b>Bank Transfers:</b> may take <b>2-3 business days</b>.
        </p>

        <p style="
          margin: 0 0 2px 0;
          font-size: 15px;
          line-height: 1.7;
        ">
          You will receive an update once your transaction has been fully processed.
        </p>

        <p style="
          margin: 0;
          font-size: 15px;
          line-height: 1.7;
        ">
          Thank you for choosing Itrust Investment.
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

function buildWithdrawalApprovedEmail({ user, transaction }) {
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
          margin: 0 0 20px 0;
          font-size: 15px;
          line-height: 1.7;
        ">
          Your <b>${transaction?.method?.mode}</b> withdrawal of
          <b>${transaction?.amount} ${user?.currency?.symbol}</b>
          has been successfully processed.
        </p>

      

        <p style="
          margin: 0 0 16px 0;
          font-size: 15px;
          line-height: 1.7;
        ">
          Please allow standard network or bank processing times for funds to reflect.
        </p>

        <p style="
          margin: 0;
          font-size: 15px;
          line-height: 1.7;
        ">
          Thank you for investing with us.
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

function buildWithdrawalDeclinedEmail({ user, transaction }) {
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
          We regret to inform you that your
          <b>${transaction?.method?.mode}</b> withdrawal request of
          <b>${transaction?.amount} ${user?.currency?.symbol}</b>
          has been declined.
        </p>

        <p style="
          margin: 0 0 16px 0;
          font-size: 15px;
          line-height: 1.7;
        ">
          For more information or to resolve this issue, please contact our
          support team at
          <a href="mailto:support@itrustinvestment.com">
            support@itrustinvestment.com
          </a>.
        </p>

        <p style="
          margin: 0;
          font-size: 15px;
          line-height: 1.7;
        ">
          We are here to help.
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
  buildWithdrawalEmail,
  buildWithdrawalApprovedEmail,
  buildWithdrawalDeclinedEmail,
};
