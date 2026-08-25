const { capitalize } = require("lodash");
const { baseTemplate, BRAND_COLOR } = require("../../messages");

function buildSavingsCreatedEmail({ user, account }) {
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
          We are excited to inform you that your
          <b>${account?.name} Account</b> has been successfully created with
          <b>Itrust Investment</b>.
        </p>

        <p style="
          margin: 0 0 16px 0;
          font-size: 15px;
          line-height: 1.7;
        ">
          You can now begin contributing towards your retirement with tax-deferred
          growth. Manage your account, view performance, and make contributions
          anytime through your trust dashboard.
        </p>

        <p style="
          margin: 0 0 16px 0;
          font-size: 15px;
          line-height: 1.7;
        ">
          If you have any questions or need help setting up your contribution plan,
          our support team is here to assist.
        </p>

        <p style="
          margin: 0;
          font-size: 15px;
          line-height: 1.7;
        ">
          Welcome to smarter retirement planning.
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

function buildContributionEmail({ user, transaction }) {
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
          We've successfully received your contribution of
          <b>${transaction?.amount}</b> to your
          <b>${transaction?.account}</b>.
        </p>

        <p style="
          margin: 0 0 16px 0;
          font-size: 15px;
          line-height: 1.7;
        ">
          Your fund has been added to your retirement savings and will begin
          accruing according to your selected investment strategy. You can view
          your updated balance in your dashboard.
        </p>

        <p style="
          margin: 0 0 16px 0;
          font-size: 15px;
          line-height: 1.7;
        ">
          If you have any questions or need help setting up your contribution plan,
          our support team is here to assist.
        </p>

        <p style="
          margin: 0;
          font-size: 15px;
          line-height: 1.7;
        ">
          Thank you for taking a step toward your financial future.
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

function buildCashoutReqEmail({ user, transaction }) {
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
          Your cashout request of <b>${transaction?.amount}</b> from your
          <b>${transaction?.account}</b> is currently processing.
        </p>

        <p style="
          margin: 0 0 16px 0;
          font-size: 15px;
          line-height: 1.7;
        ">
          Please allow some time (typically a few hours - 2 business days)
          for the funds to reflect in your cash account. If this withdrawal
          affects your tax status or you have questions, we recommend consulting
          with your financial advisor.
        </p>

        <p style="
          margin: 0 0 16px 0;
          font-size: 15px;
          line-height: 1.7;
        ">
          If you didn't authorize this transaction, contact us at
          <a href="mailto:support@itrustinvestment.com">
            support@itrustinvestment.com
          </a>.
        </p>

        <p style="
          margin: 0;
          font-size: 15px;
          line-height: 1.7;
        ">
          Thank you for taking a step toward your financial future.
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

module.exports = {
  buildSavingsCreatedEmail,
  buildContributionEmail,
  buildCashoutReqEmail,
};
