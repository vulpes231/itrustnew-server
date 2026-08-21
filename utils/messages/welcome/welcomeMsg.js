const { baseTemplate, BRAND_COLOR } = require("../../messages");

function buildWelcomeMsg(username) {
  const content = `
        <h2 style="
            margin-top: 0;
            color: ${BRAND_COLOR};
        ">
            Hello ${username || "User"}
        </h2>

        <p>
            Welcome to Itrust Investment! We're thrilled to have you on board
        </p>

        <p>
            Your account is now active and you're just a few steps away from taking full control of your financial future. Whether you're here to build long term wealth, grow your retirement savings, or explore various investment options. We're here to help every step of the way.
        </p>

        <h3>Here's what you can do next</h3>

       <ul>
            <li>Fund your cash account</li>
            <li>Choose your investment strategy</li>
            <li>Explore available assets and accounts (stocks, cryptos, IRAs, HYSA and more)</li>
            <li>Track and manage your portfolio in real time</li>
       </ul>

        <p>
            If you need any help getting started or have questions, our team is ready to assist at <a href="mailto:support@itrustinvestment.com">support@itrustinvestment.com</a>
        </p>
        <p>Thank you for using Itrust Investment!</p>
    `;

  return baseTemplate({
    title: "Welcome to Itrust Investment",
    content,
  });
}

module.exports = { buildWelcomeMsg };
