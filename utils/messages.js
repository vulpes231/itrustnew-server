const BRAND_COLOR = "#333333";
const WHITE = "#ffffff";
const BLACK = "#000000";

function baseTemplate({ content }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>Itrust Investment</title>

  <style>
    body {
      margin: 0;
      padding: 0;
      width: 100% !important;
      background-color: #f4f4f7;
      font-family: Arial, Helvetica, sans-serif;
    }

    table {
      border-spacing: 0;
      border-collapse: collapse;
    }

    img {
      border: 0;
      outline: none;
      text-decoration: none;
      display: block;
    }

    a {
      color: #5162be;
    }

    @media only screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
      }

      .content-padding {
        padding: 30px 20px !important;
      }

      .header-padding {
        padding: 24px 20px !important;
      }
    }
  </style>
</head>

<body
  style="
    margin: 0;
    padding: 0;
    width: 100%;
    background-color: #f4f4f7;
    font-family: Arial, Helvetica, sans-serif;
  "
>

  <!-- Outer wrapper -->
  <table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    bgcolor="#f4f4f7"
    style="background-color: #f4f4f7;"
  >
    <tr>
      <td align="center" style="padding: 20px 10px;">

        <!-- Main container -->
        <table
          role="presentation"
          width="600"
          cellpadding="0"
          cellspacing="0"
          border="0"
          class="email-container"
          bgcolor="#ffffff"
          style="
            width: 100%;
            max-width: 600px;
            background-color: #ffffff;
            border: 1px solid #e5e5e5;
            border-radius: 12px;
            overflow: hidden;
          "
        >

          <!-- LOGO -->
          <tr>
            <td
              align="center"
              bgcolor="#ffffff"
              class="header-padding"
              style="
                background-color: #ffffff;
                padding: 15px 20px;
              "
            >
              <img
                src="https://itrustinvestment.com/itrust.png"
                alt="Itrust Investment"
                width="150"
                style="
                  display: block;
                  width: 150px;
                  max-width: 150px;
                  height: auto;
                  margin: 0 auto;
                "
              >
            </td>
          </tr>

          <!-- CONTENT -->
          <tr>
            <td
              class="content-padding"
              bgcolor="#ffffff"
              style="
                background-color: #ffffff;
                padding: 40px 30px;
                font-family: Arial, Helvetica, sans-serif;
                font-size: 16px;
                line-height: 24px;
                color: #333333;
              "
            >
              ${content}
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td
              align="center"
              bgcolor="#fafafa"
              style="
                background-color: #fafafa;
                border-top: 1px solid #eeeeee;
                padding: 20px 30px;
                font-family: Arial, Helvetica, sans-serif;
                font-size: 12px;
                line-height: 18px;
                color: #777777;
              "
            >

              <p style="
                margin: 0 0 10px 0;
                padding: 0;
              ">
                © ${new Date().getFullYear()} Itrust Investment.
                All rights reserved.
              </p>

              <p style="
                margin: 0 0 10px 0;
                padding: 0;
              ">
                For security reasons, never share your verification code
                with anyone.
              </p>

              <p style="
                margin: 0;
                padding: 0;
              ">
                This is an automated message. Please do not reply to this email.
              </p>

            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
  `;
}

module.exports = {
  baseTemplate,
  BRAND_COLOR,
};
