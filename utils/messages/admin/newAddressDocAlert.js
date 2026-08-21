const { baseTemplate } = require("../../messages");

function buildNewAddressDocAlert(username) {
  const content = `
              <h2 style="
                  margin-top: 0;
                  color: ${BRAND_COLOR};
              ">
                  Hello Admin
              </h2>
      
              <p>
                  A user ${username} has submitted documents for address verification.
              </p>

              <p>
                Please review and process request from the dashboard.
              </p>
          `;

  return baseTemplate({
    title: "New Proof OF Address Upload",
    content,
  });
}

module.exports = { buildNewAddressDocAlert };
