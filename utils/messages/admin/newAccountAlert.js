const { baseTemplate, BRAND_COLOR } = require("../../messages");

function buildNewAccountAlert(username) {
  const content = `
              <h2 style="
                  margin-top: 0;
                  color: ${BRAND_COLOR};
              ">
                  Hello Admin
              </h2>
      
              <p>
                  A new user account ${username} has been created 
              </p>
              <p>
                  Regards
              </p>
              <p>Itrust investments</p>
          `;

  return baseTemplate({
    content,
  });
}

module.exports = { buildNewAccountAlert };
