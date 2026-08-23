const { baseTemplate, BRAND_COLOR } = require("../../messages");
const { capitalize } = require("lodash");

function buildTransferEmail({ user, transaction }) {
  const content = `
        

        <h3 style="
        margin: 0 0 24px 0;
        color: ${BRAND_COLOR};
        font-size: 24px;
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
          The transfer of
          <b> ${transaction?.amount} ${user?.currency?.symbol}</b>
          from your <b>${transaction?.method?.mode}</b> account to your
          <b>${transaction?.meta.to}</b> account has been successfully completed.
        </p>

        <p style="
          margin: 0 0 16px 0;
          font-size: 15px;
          line-height: 1.7;
        ">
          Your funds are now available for trading and investing.
        </p>

        <p style="
          margin: 0;
          font-size: 15px;
          line-height: 1.7;
        ">
          Thank you for choosing Itrust Investment.
        </p>
      `;

  return baseTemplate({
    content,
  });
}

module.exports = {
  buildTransferEmail,
};
