const BRAND_COLOR = "#333";
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
                padding: 30px 20px;
                text-align: center;
            ">
                <img 
                    src="https://www.itrustinvestments.com/logo.png" 
                    alt="Itrust Investment"
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

            <div>
                <small>Best regards</small>
                <p>Itrust Investment Team</p>
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
                    © ${new Date().getFullYear()} Itrust Investment. All rights reserved.
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

module.exports = {
  baseTemplate,
};
