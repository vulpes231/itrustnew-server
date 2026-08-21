const { baseTemplate, BRAND_COLOR } = require("../../messages");

function buildNewIdUploadAlert(username) {
  const content = `
              <h2 style="
                  margin-top: 0;
                  color: ${BRAND_COLOR};
              ">
                  Hello Admin
              </h2>
      
              <p>
                  A user ${username} has submitted KYC documents for verification.
              </p>

              <p>
                Please review and process request from the dashboard.
              </p>
          `;

  return baseTemplate({
    title: "New ID Upload",
    content,
  });
}

module.exports = { buildNewIdUploadAlert };
