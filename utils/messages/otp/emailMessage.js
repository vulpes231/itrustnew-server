const { baseTemplate, BRAND_COLOR } = require("../../messages");

function buildEmailMsg(otp) {
  const content = `
    

        <p>Hello,</p>

        <p>
            Thank you for registering with <b>Itrust Investment.</b>
        </p>
        <p>To verify your email and activate your account, please use the cobfirmation code below.</p>

        <div style="
            background: #f4f0ff;
            color: ${BRAND_COLOR};
            padding: 18px;
            text-align: center;
            font-size: 28px;
            font-weight: bold;
            letter-spacing: 4px;
            border-radius: 8px;
            margin: 30px 0;
        ">
           <b>Your Confirmation Code:</b> ${otp}
        </div>

        <p>
           If you did not create an account, please disregard this email or contact us at <a href="mailto:support@itrustinvestment.com">support@itrustinvestment.com</a> for assistance.
        </p>
        <p>Welcome to a smarter way to invest.</p>
        <div >
            <p>Best regards</p>
            <p>Itrust Investment Team</p>
        </div>
    `;

  return baseTemplate({
    content,
  });
}

function buildTwoFaMsg(otp) {
  const content = `
      

        <p>Hello,</p>

        <p>
            We received a login request for your Itrust Investment account.
            Use the verification code below to continue.
        </p>

        <div style="
            background: #f4f0ff;
            color: ${BRAND_COLOR};
            padding: 18px;
            text-align: center;
            font-size: 28px;
            font-weight: bold;
            letter-spacing: 4px;
            border-radius: 8px;
            margin: 30px 0;
        ">
            ${otp}
        </div>

        <p>
            This code expires in 10 minutes.
            If this wasn't you, please secure your account immediately.
        </p>
        <div >
            <p>Best regards</p>
            <p>Itrust Investment Team</p>
        </div>
    `;

  return baseTemplate({
    title: "Login Verification",
    content,
  });
}

module.exports = { buildEmailMsg, buildTwoFaMsg };
