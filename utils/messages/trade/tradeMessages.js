const { baseTemplate, BRAND_COLOR } = require("../../messages");

function buildBuyOrderEmail({ user, trade }) {
  const content = `
            <h2 style="
              margin-top: 0;
              color: ${BRAND_COLOR};
            ">
                Purchase Confirmation
            </h2>
        
            <p>Hello, ${user?.personalInfo?.firstName}</p>
            <p>
             You bought <b>${trade?.execution?.quantity}${trade?.asset?.symbol}</b> for <b>${trade?.execution?.amount}</b>, Your order has been placed.
            </p>
            
            <p>
              Order will be exceuted according to the type selected, You can track your order status in your dashboard.
            </p>
            <p>
              Thank you for investing with Itrust.
              </p>
          `;

  return baseTemplate({
    title: "Buy Order",
    content,
  });
}

function buildSellOrderEmail({ user, trade }) {
  const content = `
    <h2 style="
    margin-top: 0;
    color: ${BRAND_COLOR};
    ">
        Purchase Confirmation
    </h2>

    <p>Hello, ${user?.personalInfo?.firstName}</p>
    <p>
    You sold <b>${trade?.execution?.quantity}${trade?.asset?.symbol}</b> for <b>${trade?.execution?.amount}</b>, Your order has been placed.
    </p>

    <p>
    Order will be exceuted according to the type selected, You can track your order status an dpositions through your dashboard.
    </p>
    <p>
    Thank you for trading with Itrust.
    </p>
    `;

  return baseTemplate({
    title: "Sell Order",
    content,
  });
}

function isPartialClose(closedPortion) {
  return (
    closedPortion &&
    closedPortion?.percentClosed &&
    closedPortion.percentClosed !== 100
  );
}

module.exports = {
  buildBuyOrderEmail,
  buildSellOrderEmail,
};
