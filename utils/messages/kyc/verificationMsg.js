const { baseTemplate, BRAND_COLOR } = require("../../messages");

function buildIdentityVerifiedMsg(username) {
  const content = `
            <h2 style="
                margin-top: 0;
                color: ${BRAND_COLOR};
            ">
                Hello ${username || "User"}
            </h2>
    
            <p>
                We're pleased to inform you that your identity has been succesfully verified.
            </p>
            <b>What's Next?</b>
              
            <p>
               You can now have full access to your account and begin exploring investment opportunities with confidence. If you haven't already, we recommend
            </p>
            <ul>
                  <li>Funding your account to start investing</li>
                  <li>Browsing our range of investment options</li>
            </ul>
            <br>
    
            <b>Need Help?</b>
    
       
    
            <p>
                If you have any questions, our support team is here for you. Simply reply this email or visit our Help Center.
            </p>
            <p>Thank you for choosing Itrust!</p>
        `;

  return baseTemplate({
    title: "Welcome to Itrust Investment",
    content,
  });
}

module.exports = { buildIdentityVerifiedMsg };
