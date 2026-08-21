const { baseTemplate, BRAND_COLOR } = require("../../messages");

function buildTransferEmail({ user, transaction }) {
  const content = `
          <h2 style="
            margin-top: 0;
            color: ${BRAND_COLOR};
          ">
            Transfer Processed
          </h2>
      
          <p>Hello, ${user?.personalInfo?.firstName}</p>
          <p>
            The transfer of <b>${user?.currency?.symbol}${transaction?.amount}</b> from your <b>${transaction.account}</b> account to your <b>${transaction.meta.to}</b> account has been successfully completed.
          </p>
          
          <p>
            You funds are now available for trading and investing.
          </p>
          <p>
            Thank you for choosing Itrust Investment.
            </p>
        `;

  return baseTemplate({
    title: "Transfer Completed",
    content,
  });
}

module.exports = {
  buildTransferEmail,
};
