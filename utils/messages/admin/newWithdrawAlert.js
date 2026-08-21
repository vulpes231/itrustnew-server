const { baseTemplate } = require("../../messages");
const { format } = require("date-fns");

function buildNewWithdrawAlert({ user, transaction }) {
  const content = `
         
      
          <p>Hello, Admin</p>
      
          <p>
           A new withdrawal request has been submitted by user ${user?.personalInfo?.firstName} ${user?.personalInfo?.lastName}
          </p>

          <h3 style="
            color: #222;
            margin-bottom: 15px;
          ">
            Withdrawal Details
          </h3>
          <ul>
            <li> <b>Amount:</b> ${transaction?.amount}</li>
            <li> <b>Method:</b> cash withdrawal via ${transaction?.method?.mode}</li>
            <li> <b>Date:</b> ${format(transaction?.createdAt, "yyyy-mm-dd hh:mm a")}</li>
          </ul>
   
      
          <p>
            Please review and process request from the dashboard.
          </p>
        `;

  return baseTemplate({
    title: "New withdrawal Alert",
    content,
  });
}

module.exports = { buildNewWithdrawAlert };
