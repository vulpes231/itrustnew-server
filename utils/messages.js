function buildEmailMsg(otp) {
	const verifyEmailMessage = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
        <style>
            body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .logo { max-height: 50px; }
            .code { 
                background: #f5f7fa; 
                padding: 15px 25px; 
                text-align: center; 
                font-size: 24px; 
                font-weight: bold; 
                letter-spacing: 2px; 
                color: #2c3e50;
                margin: 25px 0;
                border-radius: 4px;
            }
            .footer { 
                margin-top: 40px; 
                padding-top: 20px; 
                border-top: 1px solid #eaeaea; 
                font-size: 12px; 
                color: #7f8c8d;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <img src="https://www.itrustinvestments.com/logo.png" alt="iTrust Investments" class="logo">
        </div>
        
        <h2 style="color: #2c3e50;">Email Verification Required</h2>
        
        <p>Hello,</p>
        
        <p>Thank you for registering with iTrust Investments. To complete your registration, please enter the following verification code in your application:</p>
        
        <div class="code">${otp}</div>
        
        <p>This code will expire in 15 minutes. If you didn't request this verification, please ignore this email or contact our support team immediately.</p>
        
        <div class="footer">
            <p>© ${new Date().getFullYear()} iTrust Investments. All rights reserved.</p>
            <p>For security reasons, please do not share this code with anyone.</p>
            <p>This is an automated message - please do not reply directly to this email.</p>
        </div>
    </body>
    </html>
    `;
	return verifyEmailMessage;
}

function buildTwoFaMsg(otp) {
	const twoFaMessage = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1;">
        <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://www.itrustinvestments.com/logo.png" alt="iTrust Investments" style="max-height: 60px;">
        </div>
        <h2 style="color: #2a5885;">Login Verification</h2>
        <p>Hello,</p>
        <p>We received a request to access your iTrust Investments account. Please use the following verification code:</p>
        
        <div style="background: #f5f5f5; padding: 15px; text-align: center; margin: 25px 0; font-size: 24px; font-weight: bold; letter-spacing: 2px; color: #2a5885;">
            ${otp}
        </div>
        
        <p>This code will expire in 10 minutes. If you didn't request this, please ignore this email or contact support.</p>
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e1e1e1; font-size: 12px; color: #777;">
            <p>© ${new Date().getFullYear()} iTrust Investments. All rights reserved.</p>
            <p>This is an automated message - please do not reply directly to this email.</p>
        </div>
    </div>
    `;
	return twoFaMessage;
}

function buildWelcomeMsg(username) {
	const welcomeMessage = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { text-align: center; margin-bottom: 20px; }
            .logo { max-height: 50px; }
            .cta-button {
                display: inline-block; 
                background-color: #2c82e0; 
                color: white; 
                padding: 12px 24px; 
                text-decoration: none; 
                border-radius: 4px; 
                font-weight: bold; 
                margin: 20px 0;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <img src="https://www.itrustinvestments.com/logo.png" alt="iTrust Investments" class="logo">
        </div>
        
        <h2 style="color: #2c3e50;">Welcome${username ? username : "User"}!</h2>
        
        <p>Thank you for verifying your email and joining iTrust Investments.</p>
        
        <p>You're now ready to start your investment journey. Make your first deposit to unlock the full potential of your account:</p>
        
        <p style="text-align: center;">
            <a href="https://app.itrustinvestments.com/deposit" class="cta-button">Make Your First Deposit</a>
        </p>
        
        <p>Need help getting started? Our <a href="https://www.itrustinvestments.com/help">support team</a> is always happy to assist.</p>
        
        <div style="margin-top: 40px; font-size: 12px; color: #7f8c8d;">
            <p>iTrust Investments Team</p>
            <p>© ${new Date().getFullYear()} iTrust Investments. All rights reserved.</p>
        </div>
    </body>
    </html>
    `;
	return welcomeMessage;
}

module.exports = { buildEmailMsg, buildTwoFaMsg, buildWelcomeMsg };
