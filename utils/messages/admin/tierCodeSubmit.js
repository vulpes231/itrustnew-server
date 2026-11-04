const { capitalize } = require("lodash");
const { baseTemplate, BRAND_COLOR } = require("../../messages");

function buildTierCodeMsg({ user }) {
  const content = `
         
      
          <p>Hello, Admin</p>
      
          <p style="line-height: 1;">
           A new tier code submission  by user ${capitalize(user?.firstName)} ${capitalize(user?.lastName)}
          </p>
          <p style="line-height: 1;">
            Please review and process request from the dashboard.
          </p>
        `;

  return baseTemplate({
    content,
  });
}

module.exports = { buildTierCodeMsg };
