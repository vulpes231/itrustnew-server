const { capitalize } = require("lodash");
const { baseTemplate, BRAND_COLOR } = require("../../messages");

function buildIdentityVerifiedMsg(username) {
  const content = `
          <h3 style="
            margin: 0 0 24px 0;
            color: ${BRAND_COLOR};
            font-size: 24px;
            line-height: 1.3;
            font-weight: 600;
          ">
            Hello ${capitalize(username) || "User"}
          </h3>
  
          <p style="
            margin: 0 0 16px 0;
            font-size: 15px;
            line-height: 1.7;
          ">
            We're pleased to inform you that your identity has been successfully verified.
          </p>
  
          <b style="
            display: block;
            margin: 0 0 12px 0;
            font-size: 15px;
            line-height: 1.5;
          ">
            What's Next?
          </b>
  
          <p style="
            margin: 0 0 12px 0;
            font-size: 15px;
            line-height: 1.7;
          ">
            You can now have full access to your account and begin exploring investment
            opportunities with confidence. If you haven't already, we recommend:
          </p>
  
          <ul style="
            margin: 0 0 24px 0;
            padding-left: 24px;
            font-size: 15px;
            line-height: 1.8;
          ">
            <li>Funding your account to start investing</li>
            <li>Browsing our range of investment options</li>
          </ul>
  
          <b style="
            display: block;
            margin: 0 0 12px 0;
            font-size: 15px;
            line-height: 1.5;
          ">
            Need Help?
          </b>
  
          <p style="
            margin: 0 0 16px 0;
            font-size: 15px;
            line-height: 1.7;
          ">
            If you have any questions, our support team is here for you.
            Simply reply to this email or visit our Help Center.
          </p>
  
          <p style="
            margin: 0;
            font-size: 15px;
            line-height: 1.7;
          ">
            Thank you for choosing Itrust!
          </p>
        `;

  return baseTemplate({
    content,
  });
}

module.exports = { buildIdentityVerifiedMsg };
