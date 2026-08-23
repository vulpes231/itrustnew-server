const { capitalize } = require("lodash");
const { baseTemplate, BRAND_COLOR } = require("../../messages");

function buildBuyOrderEmail({ user, trade }) {
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
          You bought
          <b>${trade?.execution?.quantity}${trade?.asset?.symbol}</b>
          for <b>${trade?.execution?.amount} ${user?.currency?.symbol}</b>. Your order has been placed.
        </p>

        <p style="
          margin: 0 0 16px 0;
          font-size: 15px;
          line-height: 1.7;
        ">
          Your order will be executed according to the selected order type.
          You can track your order status in your dashboard.
        </p>

        <p style="
          margin: 0;
          font-size: 15px;
          line-height: 1.7;
        ">
          Thank you for investing with Itrust.
        </p>
      `;

  return baseTemplate({
    content,
  });
}

function buildSellOrderEmail({ user, trade }) {
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
          You sold
          <b>${trade?.execution?.quantity}${trade?.asset?.symbol}</b>
          for <b>${trade?.execution?.amount} ${user?.currency?.symbol}</b>. Your order has been placed.
        </p>

        <p style="
          margin: 0 0 16px 0;
          font-size: 15px;
          line-height: 1.7;
        ">
          Your order will be executed according to the selected order type.
          You can track your order status and positions through your dashboard.
        </p>

        <p style="
          margin: 0;
          font-size: 15px;
          line-height: 1.7;
        ">
          Thank you for trading with Itrust.
        </p>
      `;

  return baseTemplate({
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
