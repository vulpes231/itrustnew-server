const BRAND_COLOR = "#5126be";
const WHITE = "#ffffff";
const BLACK = "#000000";

function baseTemplate({ title, content }) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title}</title>
    </head>

    <body style="
        margin: 0;
        padding: 0;
        background-color: #f4f4f7;
        font-family: Arial, sans-serif;
        color: ${BLACK};
    ">

        <div style="
            max-width: 600px;
            margin: 40px auto;
            background: ${WHITE};
            border-radius: 12px;
            overflow: hidden;
            border: 1px solid #e5e5e5;
        ">

          
            <div style="
                background: ${BRAND_COLOR};
                padding: 30px 20px;
                text-align: center;
            ">
                <img 
                    src="https://www.itrustinvestments.com/logo.png" 
                    alt="iTrust Investments"
                    style="max-height: 55px;"
                />
            </div>

          
            <div style="
                padding: 40px 30px;
                line-height: 1.7;
                font-size: 15px;
                color: #333333;
            ">
                ${content}
            </div>

         
            <div style="
                border-top: 1px solid #eeeeee;
                padding: 20px 30px;
                font-size: 12px;
                color: #777777;
                background: #fafafa;
                text-align: center;
            ">
                <p style="margin: 0 0 10px;">
                    © ${new Date().getFullYear()} iTrust Investments. All rights reserved.
                </p>

                <p style="margin: 0 0 10px;">
                    For security reasons, never share your verification code with anyone.
                </p>

                <p style="margin: 0;">
                    This is an automated message. Please do not reply to this email.
                </p>
            </div>

        </div>

    </body>
    </html>
    `;
}

function buildEmailMsg(otp) {
  const content = `
        <h2 style="
            margin-top: 0;
            color: ${BRAND_COLOR};
        ">
            Email Verification
        </h2>

        <p>Hello,</p>

        <p>
            Thank you for registering with iTrust Investments.
            Use the verification code below to complete your registration.
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
            This code will expire in 15 minutes.
            If you did not request this verification,
            please ignore this email.
        </p>
    `;

  return baseTemplate({
    title: "Email Verification",
    content,
  });
}

function buildTwoFaMsg(otp) {
  const content = `
        <h2 style="
            margin-top: 0;
            color: ${BRAND_COLOR};
        ">
            Login Verification
        </h2>

        <p>Hello,</p>

        <p>
            We received a login request for your iTrust Investments account.
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
    `;

  return baseTemplate({
    title: "Login Verification",
    content,
  });
}

function buildWelcomeMsg(username) {
  const content = `
        <h2 style="
            margin-top: 0;
            color: ${BRAND_COLOR};
        ">
            Welcome ${username || "User"} 🎉
        </h2>

        <p>
            Thank you for verifying your email and joining iTrust Investments.
        </p>

        <p>
            Your account is now active and ready for use.
            Start your investment journey today by making your first deposit.
        </p>

        <div style="text-align: center; margin: 35px 0;">
            <a
                href="https://app.itrustinvestments.com/deposit"
                style="
                    display: inline-block;
                    background: ${BRAND_COLOR};
                    color: ${WHITE};
                    text-decoration: none;
                    padding: 14px 28px;
                    border-radius: 8px;
                    font-weight: bold;
                    font-size: 15px;
                "
            >
                Make Your First Deposit
            </a>
        </div>

        <p>
            Need help getting started?
            Visit our support center anytime.
        </p>
    `;

  return baseTemplate({
    title: "Welcome to iTrust Investments",
    content,
  });
}

function buildTransactionEmail({
  type,
  amount,
  symbol,
  currencyName,
  method,
  status,
  buttonText,
  buttonLink,
  message,
}) {
  const content = `
        <h2 style="
            margin-top: 0;
            color: ${BRAND_COLOR};
        ">
            ${type}
        </h2>

        <p>Hello,</p>

        <p>
            ${message}
        </p>

        <div style="
            background: #f4f0ff;
            border-left: 4px solid ${BRAND_COLOR};
            padding: 20px;
            border-radius: 8px;
            margin: 30px 0;
        ">
            <p style="
                margin: 0;
                font-size: 22px;
                font-weight: bold;
                color: ${BRAND_COLOR};
            ">
                ${symbol}${amount} ${currencyName}
            </p>

            <p style="
                margin: 10px 0 0;
                color: #555;
            ">
                via ${method}
            </p>
        </div>

        <h3 style="
            color: #222;
            margin-bottom: 15px;
        ">
            Transaction Details
        </h3>

        <table style="
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
        ">
            <tr>
                <td style="
                    padding: 10px 0;
                    color: #666;
                ">
                    Amount
                </td>

                <td style="
                    padding: 10px 0;
                    text-align: right;
                    font-weight: bold;
                ">
                    ${symbol}${amount} ${currencyName}
                </td>
            </tr>

            <tr>
                <td style="
                    padding: 10px 0;
                    color: #666;
                ">
                    Method
                </td>

                <td style="
                    padding: 10px 0;
                    text-align: right;
                    font-weight: bold;
                ">
                    ${method}
                </td>
            </tr>

            <tr>
                <td style="
                    padding: 10px 0;
                    color: #666;
                ">
                    Status
                </td>

                <td style="
                    padding: 10px 0;
                    text-align: right;
                    font-weight: bold;
                    color: green;
                ">
                    ${status}
                </td>
            </tr>

            <tr>
                <td style="
                    padding: 10px 0;
                    color: #666;
                ">
                    Date
                </td>

                <td style="
                    padding: 10px 0;
                    text-align: right;
                    font-weight: bold;
                ">
                    ${new Date().toLocaleString()}
                </td>
            </tr>
        </table>

        <div style="
            text-align: center;
            margin: 35px 0;
        ">
            <a
                href="${buttonLink}"
                style="
                    display: inline-block;
                    background: ${BRAND_COLOR};
                    color: ${WHITE};
                    text-decoration: none;
                    padding: 14px 28px;
                    border-radius: 8px;
                    font-weight: bold;
                    font-size: 15px;
                "
            >
                ${buttonText}
            </a>
        </div>

        <p style="
            color: #666;
            font-size: 14px;
        ">
            If you did not authorize this transaction,
            please contact our support team immediately.
        </p>
    `;

  return baseTemplate({
    title: type,
    content,
  });
}

function buildTradeMessage({
  title,
  message,
  trade,
  actionColor,
  actionLabel,
  isClosing = false,
  profitLoss = null,
  profitLossFormatted = null,
  profitLossClass = "",
  closeType = "",
  closedPortion = null,
}) {
  const content = `
        <h2 style="
            margin-top: 0;
            color: #5126be;
        ">
            ${title}
        </h2>

        <p>Hello,</p>

        <div style="
            background: #f4f0ff;
            border-left: 4px solid ${actionColor};
            padding: 20px;
            border-radius: 8px;
            margin: 30px 0;
        ">
            <p style="
                margin: 0;
                font-size: 18px;
                color: #333;
            ">
                ${
                  trade.asset.img
                    ? `
                    <img 
                        src="${trade.asset.img}" 
                        alt="${trade.asset.symbol}"
                        width="28"
                        height="28"
                        style="
                            vertical-align: middle;
                            margin-right: 8px;
                            border-radius: 50%;
                        "
                    />
                `
                    : "📊"
                }

                ${message}
            </p>
        </div>

        ${
          isClosing && isPartialClose(closedPortion)
            ? `
            <div style="
                background: #fafafa;
                border: 1px solid #eeeeee;
                padding: 18px;
                border-radius: 8px;
                margin-bottom: 25px;
            ">
                <h3 style="
                    margin-top: 0;
                    color: #222;
                ">
                    Partial Close Details
                </h3>

                <table style="
                    width: 100%;
                    border-collapse: collapse;
                ">
                    <tr>
                        <td style="padding: 8px 0; color: #666;">
                            Closed Percentage
                        </td>

                        <td style="
                            padding: 8px 0;
                            text-align: right;
                            font-weight: bold;
                        ">
                            ${closedPortion?.percentClosed}%
                        </td>
                    </tr>

                    <tr>
                        <td style="padding: 8px 0; color: #666;">
                            Principal Closed
                        </td>

                        <td style="
                            padding: 8px 0;
                            text-align: right;
                            font-weight: bold;
                        ">
                            $${closedPortion?.principalClosed?.toFixed(2)}
                        </td>
                    </tr>

                    <tr>
                        <td style="padding: 8px 0; color: #666;">
                            Remaining Principal
                        </td>

                        <td style="
                            padding: 8px 0;
                            text-align: right;
                            font-weight: bold;
                        ">
                            $${closedPortion?.remainingPrincipal?.toFixed(2)}
                        </td>
                    </tr>

                    <tr>
                        <td style="padding: 8px 0; color: #666;">
                            Remaining Quantity
                        </td>

                        <td style="
                            padding: 8px 0;
                            text-align: right;
                            font-weight: bold;
                        ">
                            ${(trade.execution.quantity || 0).toFixed(4)}
                        </td>
                    </tr>
                </table>
            </div>
        `
            : ""
        }

        <h3 style="
            color: #222;
            margin-bottom: 15px;
        ">
            Trade Details
        </h3>

        <table style="
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
        ">
            <tr>
                <td style="
                    padding: 10px 0;
                    color: #666;
                ">
                    Action
                </td>

                <td style="
                    padding: 10px 0;
                    text-align: right;
                    font-weight: bold;
                    color: ${actionColor};
                ">
                    ${actionLabel}
                </td>
            </tr>

            <tr>
                <td style="
                    padding: 10px 0;
                    color: #666;
                ">
                    Asset
                </td>

                <td style="
                    padding: 10px 0;
                    text-align: right;
                    font-weight: bold;
                ">
                    ${trade.asset.name} (${trade.asset.symbol})
                </td>
            </tr>

            ${
              !isClosing
                ? `
                <tr>
                    <td style="
                        padding: 10px 0;
                        color: #666;
                    ">
                        Quantity
                    </td>

                    <td style="
                        padding: 10px 0;
                        text-align: right;
                        font-weight: bold;
                    ">
                        ${parseFloat(trade.execution.quantity).toFixed(6)}
                    </td>
                </tr>
            `
                : ""
            }

            ${
              isClosing
                ? `
                <tr>
                    <td style="
                        padding: 10px 0;
                        color: #666;
                    ">
                        Exit Price
                    </td>

                    <td style="
                        padding: 10px 0;
                        text-align: right;
                        font-weight: bold;
                    ">
                        $${
                          closedPortion?.exitPrice ||
                          trade.targets?.exitPoint ||
                          "N/A"
                        }
                    </td>
                </tr>

                <tr>
                    <td style="
                        padding: 10px 0;
                        color: #666;
                    ">
                        Profit / Loss
                    </td>

                    <td style="
                        padding: 10px 0;
                        text-align: right;
                        font-weight: bold;
                        color: ${profitLoss >= 0 ? "green" : "red"};
                    ">
                        ${profitLossFormatted}
                    </td>
                </tr>
            `
                : ""
            }

            <tr>
                <td style="
                    padding: 10px 0;
                    color: #666;
                ">
                    Date
                </td>

                <td style="
                    padding: 10px 0;
                    text-align: right;
                    font-weight: bold;
                ">
                    ${new Date().toLocaleString()}
                </td>
            </tr>
        </table>

        ${
          isClosing &&
          closedPortion?.percentClosed &&
          closedPortion.percentClosed !== 100
            ? `
            <p>
                Your remaining position is still active and can be managed
                from your portfolio dashboard.
            </p>
        `
            : ""
        }

        <div style="
            text-align: center;
            margin: 35px 0;
        ">
            <a
                href="https://app.itrustinvestments.com/dashboard"
                style="
                    display: inline-block;
                    background: #5126be;
                    color: #ffffff;
                    text-decoration: none;
                    padding: 14px 28px;
                    border-radius: 8px;
                    font-weight: bold;
                    font-size: 15px;
                "
            >
                View Portfolio
            </a>
        </div>

        <p style="
            color: #666;
            font-size: 14px;
        ">
            If you did not authorize this trade activity,
            please contact support immediately.
        </p>
    `;

  return baseTemplate({
    title,
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
  buildEmailMsg,
  buildTwoFaMsg,
  buildWelcomeMsg,
  buildTransactionEmail,
  buildTradeMessage,
};
