const { baseTemplate } = require("../../messages");
const { format } = require("date-fns");

function buildNewTradeAlert({ user, trade }) {
  const content = `
         
      
          <p>Hello, Admin</p>
      
          <p>
           A new order ${trade?.asset?.symbol} has been created by user ${user?.personalInfo?.firstName} ${user?.personalInfo?.lastName}
          </p>

          <h3 style="
            color: #222;
            margin-bottom: 15px;
          ">
            Trade Details
          </h3>
          <ul>
            <li> <b>Amount:</b>  ${trade?.orderType}</li>
            <li> <b>Amount:</b> ${trade?.execution?.amount}</li>
            <li> <b>Quantity:</b>  ${trade?.execution?.quantity}</li>
            <li> <b>Date:</b> ${format(trade?.createdAt, "yyyy-mm-dd hh:mm a")}</li>
          </ul>
 
        `;

  return baseTemplate({
    title: "New Trade Alert",
    content,
  });
}

module.exports = { buildNewTradeAlert };
