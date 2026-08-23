const { baseTemplate, BRAND_COLOR } = require("../../messages");
const { format } = require("date-fns");

function buildNewTransferAlert({ user, transaction }) {
  const content = `
          <p>Hello, Admin</p>
      
          <p>
           A new transfer has been completed by user ${user?.personalInfo?.username} 
          </p>

          <h3 style="
            color: #222;
            margin-bottom: 15px;
          ">
            Transfer Details
          </h3>
          <ul>
            <li> <b>Amount:</b> ${transaction?.amount}</li>
            <li> <b>From:</b> ${transaction?.account}</li>
            <li> <b>To:</b> ${transaction?.meta?.to}</li>
            <li> <b>Date:</b> ${format(transaction?.createdAt, "yyyy-mm-dd hh:mm a")}</li>
          </ul>
        `;

  return baseTemplate({
    content,
  });
}

module.exports = { buildNewTransferAlert };
