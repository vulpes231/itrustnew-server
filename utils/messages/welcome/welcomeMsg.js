const { baseTemplate, BRAND_COLOR } = require("../../messages");

function buildWelcomeMsg(username) {
  const content = `
          <h2 style="
            margin: 0 0 24px 0;
            color: ${BRAND_COLOR};
            font-size: 24px;
            line-height: 1.3;
            font-weight: 600;
          ">
            Hello ${username || "User"}
          </h2>
  
          <p style="
            margin: 0 0 16px 0;
            font-size: 15px;
            line-height: 1.7;
          ">
            Welcome to Itrust Investment! We're thrilled to have you on board.
          </p>
  
          <p style="
            margin: 0 0 20px 0;
            font-size: 15px;
            line-height: 1.7;
          ">
            Your account is now active and you're just a few steps away from
            taking full control of your financial future. Whether you're here
            to build long-term wealth, grow your retirement savings, or explore
            various investment options, we're here to help every step of the way.
          </p>
  
          <h3 style="
            margin: 0 0 12px 0;
            font-size: 18px;
            line-height: 1.4;
            font-weight: 600;
          ">
            Here's what you can do next
          </h3>
  
          <ul style="
            margin: 0 0 24px 0;
            padding-left: 24px;
            font-size: 15px;
            line-height: 1.8;
          ">
            <li>Fund your cash account</li>
            <li>Choose your investment strategy</li>
            <li>
              Explore available assets and accounts (stocks, cryptos, IRAs,
              HYSA and more)
            </li>
            <li>Track and manage your portfolio in real time</li>
          </ul>
  
          <p style="
            margin: 0 0 16px 0;
            font-size: 15px;
            line-height: 1.7;
          ">
            If you need any help getting started or have questions, our team is
            ready to assist at
            <a href="mailto:support@itrustinvestment.com">
              support@itrustinvestment.com
            </a>.
          </p>
  
          <p style="
            margin: 0;
            font-size: 15px;
            line-height: 1.7;
          ">
            Thank you for using Itrust Investment!
          </p>
        `;

  return baseTemplate({
    content,
  });
}

module.exports = { buildWelcomeMsg };
